# The practice site on the Play Store

A practice site already installs from the browser as an app: its manifest,
icons and service worker (`docs/OPERATIONS.md`, "Practice sites as an app").
To be found on the Play Store as well, it is wrapped in a **Trusted Web
Activity** (TWA): a small Android app that opens the site full screen, with no
browser bar, and that Android trusts because the site says so at
`/.well-known/assetlinks.json`.

The server side is built. What it needs is an account and a decision only the
owner can make.

## What the owner provides

| What | Why |
|---|---|
| A Google Play Console account (one-time fee) | Only its owner can publish an app |
| The app's name and its package name, e.g. `in.parikshaa.practice` | The package name can never change once published |
| Which site it opens: one site's address, `/practice/<site>/home` | A TWA opens one start address |
| Who keeps the signing key | Losing it means a new app; Play App Signing keeps a copy |
| A privacy policy for learners, at a public address | Play will not publish without one |

## The steps

1. Install Bubblewrap, Google's TWA tool, on a machine with a JDK and the
   Android SDK (it offers to download both):

   ```sh
   npm i -g @bubblewrap/cli
   bubblewrap init --manifest https://exam.example.ac.in/api/practice/<site>/manifest.webmanifest
   ```

   It reads the site's name, colours, icons and start address from the
   manifest, asks for the package name, and makes a signing key. Keep the key
   and its password out of the repository.

2. Build the app bundle: `bubblewrap build` gives `app-release-bundle.aab`.

3. Give the server the app's identity, and restart it:

   ```sh
   TWA_PACKAGE=in.parikshaa.practice
   TWA_SHA256=AB:CD:…   # keytool -list -v -keystore android.keystore
   ```

   With Play App Signing, add Play's app signing key's fingerprint too (Play
   Console → Setup → App signing), comma-separated. Check that
   `https://<host>/.well-known/assetlinks.json` answers with both.

4. Upload the bundle in Play Console, fill in the listing (screenshots, and
   the address of a privacy policy: Play asks for one, and the site has no
   learner-facing policy page yet; `docs/legal/` holds the DPA for
   institutions, not it), and send it for review.

If `assetlinks.json` and the key do not match, the app still opens, but with a
browser bar on top: that is the sign to check step 3.
