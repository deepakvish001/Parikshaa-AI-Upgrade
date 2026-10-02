#!/usr/bin/env bash
# Releases Parikshaa to staging or production (docs/DEPLOY-AWS.md, "Release").
#
#   deploy/aws/scripts/release.sh staging                  # build HEAD, release it
#   deploy/aws/scripts/release.sh staging --ref v1.4.0     # build a tag or commit
#   deploy/aws/scripts/release.sh production --tag 3f2a…   # what staging runs, unbuilt
#   deploy/aws/scripts/release.sh production --tag <older> # roll back the code
#   deploy/aws/scripts/release.sh production --images-only # build and push, nothing else
#
# 1. Builds both images from the committed tree (git archive: an uncommitted
#    change never ships) for linux/amd64, tags them with the commit, and
#    pushes them to the shared repositories. --tag skips this and releases
#    images already there, so production runs exactly what staging tested.
# 2. Runs the migrations on one API machine, over Session Manager. If they
#    fail, nothing else has changed. They are forward only: rolling back the
#    code keeps the newer schema, which is why a migration must suit the
#    previous release too.
# 3. Moves the released tag, then replaces the runner machines and the API
#    machines one at a time, a new one healthy before an old one goes. A
#    replacement that fails puts the tag back.
# 4. Runs the server check (scripts/smoke.mjs) against the site.
#
# --images-only stops after step 1 and prints the tag: moving a pilot's data
# in needs the images before the database has any tables (parikshaa-import).
#
# Never on an exam day: a machine being replaced ends its open connections,
# and candidates reconnect, but a sitting is no time for that.
#
# Needs git, docker (with buildx), the AWS CLI, jq, node, and terraform (or
# STACK_JSON, the stack's outputs as JSON).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
poll="${RELEASE_POLL_SECONDS:-15}"
die() { printf 'release: %s\n' "$*" >&2; exit 1; }
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

env="${1:-}"
[[ "$env" == staging || "$env" == production ]] || die "usage: $0 <staging|production> [--ref REF | --tag TAG] [--images-only] [--skip-smoke]"
shift
ref=HEAD
tag=""
smoke=true
images_only=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) ref="${2:?--ref needs a git ref}"; shift ;;
    --tag) tag="${2:?--tag needs an image tag}"; shift ;;
    --skip-smoke) smoke=false ;;
    --images-only) images_only=true ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

stack="${STACK_JSON:-$(terraform -chdir="$here/../envs/$env" output -json stack)}"
out() { jq -r --arg k "$1" '.[$k]' <<<"$stack"; }
region="$(out region)"
domain="$(out domain)"
api_repository="$(out api_repository)"
runner_repository="$(out runner_repository)"
tag_parameter="$(out image_tag_parameter)"
api_group="$(out api_group)"
runner_group="$(out runner_group)"
aws_() { aws --region "$region" "$@"; }

if [[ "$env" == production && "$images_only" == false && "${CONFIRM:-}" != production ]]; then
  read -r -p "Releasing to PRODUCTION ($domain). Is any sitting open now? Type production to go on: " answer
  [[ "$answer" == production ]] || die "stopped"
fi

image_exists() {
  local name="${1#*/}"
  aws_ ecr describe-images --repository-name "$name" --image-ids "imageTag=$2" >/dev/null 2>&1
}

# --- 1. Images ----------------------------------------------------------------

if [[ -z "$tag" ]]; then
  commit="$(git -C "$repo" rev-parse --verify "$ref^{commit}")"
  tag="${commit:0:12}"
  logged_in=false
  # Tags never move (the repositories are immutable): build only what is missing.
  for pair in "Dockerfile $api_repository" "Dockerfile.runner $runner_repository"; do
    dockerfile="${pair%% *}"
    repository="${pair#* }"
    if image_exists "$repository" "$tag"; then
      say "$repository:$tag is already pushed"
      continue
    fi
    if [[ "$logged_in" == false ]]; then
      aws_ ecr get-login-password | docker login --username AWS --password-stdin "${repository%%/*}" >/dev/null
      logged_in=true
    fi
    say "Building $repository:$tag ($ref)"
    git -C "$repo" archive --format=tar "$commit" |
      docker buildx build --platform linux/amd64 --file "$dockerfile" --tag "$repository:$tag" --push -
  done
else
  image_exists "$api_repository" "$tag" || die "no API image tagged $tag in $api_repository"
  image_exists "$runner_repository" "$tag" || die "no runner image tagged $tag in $runner_repository"
fi

if [[ "$images_only" == true ]]; then
  say "Images pushed: $tag"
  echo "$tag"
  exit 0
fi

# --- 2. Migrations ------------------------------------------------------------

say "Migrating to $tag"
# The backticks are JMESPath literals, not the shell's.
# shellcheck disable=SC2016
instance="$(aws_ autoscaling describe-auto-scaling-groups --auto-scaling-group-names "$api_group" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId | [0]' --output text)"
[[ -n "$instance" && "$instance" != None ]] || die "no API machine in service in $api_group"
command="$(aws_ ssm send-command --instance-ids "$instance" --document-name AWS-RunShellScript \
  --comment "parikshaa migrate $tag" \
  --parameters "$(jq -cn --arg c "/usr/local/bin/parikshaa-migrate $tag" '{commands: [$c], executionTimeout: ["1800"]}')" \
  --query Command.CommandId --output text)"
deadline=$((SECONDS + 2400))
while :; do
  status="$(aws_ ssm get-command-invocation --command-id "$command" --instance-id "$instance" --query Status --output text 2>/dev/null || echo Pending)"
  case "$status" in
    Pending | InProgress | Delayed)
      ((SECONDS < deadline)) || die "the migrations have not finished in 40 minutes (command $command on $instance); nothing else was changed"
      sleep "$poll" ;;
    *) break ;;
  esac
done
aws_ ssm get-command-invocation --command-id "$command" --instance-id "$instance" \
  --query '[StandardOutputContent, StandardErrorContent]' --output text
[[ "$status" == Success ]] || die "the migrations ended $status on $instance; nothing else was changed"

# --- 3. Machines --------------------------------------------------------------

previous="$(aws_ ssm get-parameter --name "$tag_parameter" --query Parameter.Value --output text)"
aws_ ssm put-parameter --name "$tag_parameter" --value "$tag" --overwrite >/dev/null

refresh() {
  local group="$1" id state
  say "Replacing the machines of $group"
  id="$(aws_ autoscaling start-instance-refresh --auto-scaling-group-name "$group" \
    --preferences '{"MinHealthyPercentage":100,"MaxHealthyPercentage":200,"InstanceWarmup":180}' \
    --query InstanceRefreshId --output text)" || { echo "  could not start (is one already running?)"; return 1; }
  while :; do
    state="$(aws_ autoscaling describe-instance-refreshes --auto-scaling-group-name "$group" --instance-refresh-ids "$id" \
      --query 'InstanceRefreshes[0].[Status, PercentageComplete]' --output text)"
    case "${state%%[[:space:]]*}" in
      Successful) echo "  done"; return 0 ;;
      Pending | InProgress | Cancelling | RollbackInProgress | Baking) echo "  $state"; sleep "$poll" ;;
      *) echo "  $state"; return 1 ;;
    esac
  done
}

if ! refresh "$runner_group" || ! refresh "$api_group"; then
  aws_ ssm put-parameter --name "$tag_parameter" --value "$previous" --overwrite >/dev/null
  die "replacing the machines failed; the released tag is back at $previous. Machines already replaced run $tag until: $0 $env --tag $previous"
fi

# --- 4. The server check ------------------------------------------------------

if [[ "$smoke" == true ]]; then
  say "The server check"
  node "$repo/scripts/smoke.mjs" "https://$domain"
fi
say "Released $tag to $env (was $previous)."
