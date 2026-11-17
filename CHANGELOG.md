# Changelog

## 4.1.1 — Android navigation and safe-area fix (2026-11-17)

- Added a visible back button in personal settings and preserved the previous page.
- Added mobile header spacing, Android edge-to-edge insets, and readable system bar icons.
- Android versionCode 6; retained the 4.1.0 preview signing identity.
- Android update only; Windows installers remain at 4.1.0. See [release notes](docs/CHANGELOG-4.1.1.md).

## 4.0.0 — Cross-platform packaging foundation

- Prepared a locally bundled Capacitor Android application.
- Added a Tauri Windows desktop build configuration and CI workflows.
- Added engineering, privacy, installation, and release documentation.
- Existing web experience remains available and stores profile data locally.

### Limitations

- The public GitHub repository is available. Android and Windows artifacts will be published only after their GitHub Actions release jobs complete successfully.
- AI providers, real-time job search, salary data, accounts, and cloud sync are not connected.
