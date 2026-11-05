# Android application updates

The domestic APK checks the fixed manifest at `https://121.40.27.226:9443/downloads/android-latest.json`. A new version must keep application ID `cn.zaopic.etomd`, the existing signing certificate, and a strictly higher Android `versionCode`. Android still presents its own installation confirmation.

## Prepare a release

Build and verify the domestic APK through the normal release procedure. Keep its canonical APK, `release.json`, and `verification.json` in the immutable version directory. The seal must include `apkSealed: true`, the verified signing certificate, and `apkManifest` identity/minimum SDK. Never rebuild or replace a sealed APK under the same version number.

Write a notes JSON file containing `releaseNotes` and optional `releaseNotesEn`, each with 1–30 strings of at most 500 characters. Then run the generator from `tarot-vue`:

```powershell
node scripts/mobile-update-feed.mjs --release=../.cache/mobile-20261028/artifacts/0.1.8/domestic/release.json --notes=../.cache/updater-20261029/publish/notes.json --out=../.cache/updater-20261029/publish/0.1.8 --published-at=2026-10-29T12:00:00.000Z
```

Use the actual publication timestamp. Without `--published-at`, the generator uses the release's stable `builtAt`. The output is exactly four public candidates: versioned APK, APK `.sha256`, versioned release JSON, and `android-latest.json`. It checks actual APK bytes and SHA256 against the seal and rejects every existing output whose bytes differ. Use a fresh staging directory when changing a candidate.

## Publish static files

The repository script `tarot-vue/scripts/publish-mobile-update.py` defaults to a read-only inspection. It locates the workspace from its own path and uses the existing local SSH key and known-host verification for the domestic host. It has no Nginx edits, service restarts, database operations, business API calls, or overseas operations. Run publication commands from the repository root.

```powershell
& 'D:/anaconda3/python.exe' 'tarot-vue/scripts/publish-mobile-update.py' --inspect
& 'D:/anaconda3/python.exe' 'tarot-vue/scripts/publish-mobile-update.py' --publish --bundle='.cache/updater-20261029/publish/0.1.8'
& 'D:/anaconda3/python.exe' 'tarot-vue/scripts/publish-mobile-update.py' --verify --bundle='.cache/updater-20261029/publish/0.1.8'
```

Before publishing, inspect the current destination. The script stops if the known HTTPS listener/static root, resolved download directory, or publication baseline has changed. Versioned files use atomic creation and are immutable: byte-identical existing files are accepted; different files abort. The latest feed requires a higher version code (or byte-identical idempotent content), backs up the prior feed, and is replaced atomically only after versioned files pass verification. The final check downloads all four public static files over certificate-verified HTTPS and compares their complete bytes.

A publication receipt records the unique run ID and prior feed hash. If public verification fails after publication, retain that receipt and inspect the failure. To restore only the previous feed, use the receipt's run ID:

```powershell
& 'D:/anaconda3/python.exe' 'tarot-vue/scripts/publish-mobile-update.py' --rollback=RECEIPT_RUN_ID
```

Rollback refuses to overwrite a newer or independently modified feed. Published versioned APK files remain available. Future whole-website deployments must preserve the `downloads` directory, including `android-latest.json`, rather than replacing it with a stale copy.

## Local verification

From `tarot-vue`, run the manifest tests:

```powershell
node --import tsx --test tests/mobileUpdateFeed.test.ts
```

From the repository root, run the publication policy tests:

```powershell
& 'D:/anaconda3/python.exe' 'tarot-vue/tests/test_publish_mobile_update.py'
```

These tests check manifest bounds, signing/identity seal checks, actual byte mismatch, immutable staging, static publication ordering, lower-version rejection, stale rollback refusal, and APK retention. The Python tests use temporary local directories and a test lock stub; they do not connect to SSH or make HTTP requests. Linux `flock` is used by the real remote publisher.
