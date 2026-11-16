# Changelog

## 1.0.0 — First public GitHub release

- Published the Android Debug APK and Windows EXE/MSI installers from GitHub Actions, with SHA256 checksum files.
- The release tag is `v1.0.0`; app and installer metadata remains `4.0.0`.
- Android uses the standard Debug signing key; Windows installers are not code-signed.

## 4.0.0 — Cross-platform packaging foundation

- Prepared a locally bundled Capacitor Android application.
- Added a Tauri Windows desktop build configuration and CI workflows.
- Added engineering, privacy, installation, and release documentation.
- Existing web experience remains available and stores profile data locally.

### Limitations

- Android and Windows installation packages are available from the `v1.0.0` GitHub Release.
- AI providers, real-time job search, salary data, accounts, and cloud sync are not connected.
