#!/bin/bash
# A machine's first boot, run once by cloud-init after it has written the
# files beside this one: Docker and the AWS CLI; gVisor on a runner; the RDS
# certificates on an API machine; then the service, which starts the released
# image (or the placeholder, before the first release).
set -euxo pipefail
# shellcheck disable=SC1091
. /etc/parikshaa/stack.env
export DEBIAN_FRONTEND=noninteractive

# The network can still be settling this early in a first boot.
retry() {
  local n
  for n in 1 2 3 4 5 6; do
    "$@" && return 0
    sleep $((n * 10))
  done
  return 1
}

retry apt-get update -q
retry apt-get install -y -q docker.io jq curl ca-certificates gnupg
snap list aws-cli >/dev/null 2>&1 || retry snap install aws-cli --classic
systemctl enable --now docker

if [[ "$ROLE" == runner ]]; then
  # As scripts/setup-server.sh installs it.
  arch="$(dpkg --print-architecture)"
  retry curl -fsSL -o /tmp/gvisor.key https://gvisor.dev/archive.key
  gpg --dearmor --yes -o /usr/share/keyrings/gvisor-archive-keyring.gpg /tmp/gvisor.key
  echo "deb [arch=$arch signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" >/etc/apt/sources.list.d/gvisor.list
  retry apt-get update -q
  retry apt-get install -y -q runsc
  runsc install
  systemctl restart docker
else
  retry curl -fsSL "https://truststore.pki.rds.amazonaws.com/$REGION/$REGION-bundle.pem" -o /etc/parikshaa/rds-ca.pem
  chmod 644 /etc/parikshaa/rds-ca.pem
fi

systemctl daemon-reload
systemctl enable parikshaa.service
systemctl start parikshaa.service
