# Cross-platform migration baseline

Inspection date: 2026-08-04 (Asia/Shanghai).

## Upstream baseline

- Upstream: `https://github.com/XxHuberrr/Mineradio.git`
- Latest stable release: `v2.1.0`
- Annotated Tag object: `37993d337c73b130e4a81da7c973b8d246fe32a3`
- Exact release commit: `96091d123b36783f5604d1acd47b00b0708cabbd`
- Release commit tree: `b1b9f80a72d96afcbc8b4685256c3adba9014551`
- Release commit verification: valid PGP verification on GitHub; the annotated Tag itself is unsigned.
- Published Windows installer SHA-256: `9bc30b74b5c1ada68bcf13511164b16fc05a54c598c07a57d57dd3bda07c13be`

`git merge-base --is-ancestor 96091d123b36783f5604d1acd47b00b0708cabbd HEAD`
passes. Upstream `main` is one README-only commit ahead of the release and has no post-release business-code changes at this inspection.

## Host and test baseline

- Host: macOS 15.6.1 (24G90), Darwin 24.6.0, Apple Silicon `arm64`
- Node.js: 26.4.0
- npm: 11.17.0
- Locked Electron: 42.4.1
- Locked electron-builder: 26.15.3
- Locked music-metadata: 11.14.0

Before dependencies were installed, `npm run test:platform` passed 11 tests and
`node scripts/quick-check.js` failed the first FLAC metadata assertion. The
parser could not import the absent `music-metadata` package and correctly fell
back to the filename `Song`; this was an environment failure, not a verified
metadata regression.

After `npm ci`:

- `npm run test:shared`: 2 passed, 0 failed, 0 skipped.
- `npm run test:platform`: 23 passed, 0 failed, 0 skipped.
- The FLAC persistence suite: 6 passed, 0 failed, 0 skipped.
- `node scripts/quick-check.js` proceeds beyond provider and renderer tests,
  then fails the Windows Wallpaper Engine fixture path assertion because macOS
  canonicalizes `/var/...` as `/private/var/...`.

The Windows-native Wallpaper Engine assertion has not been weakened or copied
into a fake macOS test. Electron smoke was not run at this baseline because the
existing helper resolves only `electron.exe` and does not fully isolate
`userData`, `sessionData`, provider environment variables, and cache paths.

## Capability matrix

| Area | Shared | Windows x64 | macOS arm64 |
| --- | --- | --- | --- |
| Provider APIs, playback, queues, lyrics rendering, visual state | Shared candidate; hidden OS/device assumptions still require behavior tests | Supported | Supported in shared code; native runtime smoke pending |
| Local music library | Shared persistence and metadata implementation | Existing behavior | Unicode metadata passes on this host; file permission and packaged-app QA pending |
| Main lifecycle | Shared composition root | Quit after final window | Keep app alive, rebuild/focus on activate, Dock restore implemented |
| Main window | Shared BrowserWindow creation | Existing frameless window | Native hidden-inset title bar and traffic lights implemented; renderer chrome polish pending |
| Desktop lyrics | Shared state and renderer | Existing always-on-top window plus Windows middle-click poller | Native panel/all-Spaces setup implemented; click-through, drag, fullscreen and real-device QA pending |
| Global shortcuts | Shared registration code currently accepts Electron accelerators | Existing behavior; native QA pending | Implementation and Command-oriented UX tests pending |
| System memory snapshot | Shared Node snapshot candidate | Existing | Contract extraction and validation pending |
| App/system memory trimming | No | PowerShell implementation | Explicit unsupported contract and renderer gating pending |
| Full desktop mode | No | HWND/WorkerW/Progman/DWM implementation | Explicitly unsupported and capability-gated |
| Wallpaper Engine | No | Steam/registry/DWM/window runtime | Explicitly unsupported and capability-gated |
| Tray close behavior | No | Existing tray | Explicitly unsupported; renderer falls back to exit |
| Installer/build | Shared package metadata only | Existing x64 NSIS configuration | arm64 DMG, `.icns`, entitlements and builder configuration pending |
| Signing/release | Shared integrity gates | Authenticode credentials and native QA required | Developer ID, notarization, stapling and Gatekeeper QA required |

## Current security and architecture risks

1. `desktop/main.js` still directly constructs Windows memory, Wallpaper Engine,
   and full-desktop runtimes. The platform adapter now owns lifecycle/window
   setup and desktop-mode IPC, but the remaining native IPC must move behind
   capability checks before macOS can be called isolated.
2. Desktop lyrics, memory, restart, cache, hotkey, and several account IPC
   channels still need sender/top-frame/origin and payload validation.
3. External navigation needs one HTTPS/allowlisted main-process validator before
   calling `shell.openExternal`.
4. The existing Electron smoke inherits too much process environment and does
   not isolate every Chromium/provider path. Do not run it with real user state.
5. Formal Windows and macOS artifacts must be built and tested on their native
   target runners from the same exact candidate SHA. Mocks on the other OS are
   not release evidence.

## File ownership for the next slices

- Integration only: `desktop/main.js`, `desktop/preload.js`, `desktop/platform/index.js`,
  contract/capabilities/IPC, `package.json`, and `package-lock.json`.
- Shared implementation: `desktop/shared/` and pure business modules.
- Windows platform: `desktop/platform/windows/` and Windows native helpers.
- macOS platform: `desktop/platform/macos/` and macOS resources.
- Renderer UX: capability-driven `public/` controls and copy.
- Test architecture: `tests/shared/`, `tests/contracts/`, and isolated smoke orchestration.
- Build/signing: `.github/workflows/`, builder configuration, build resources,
  signing/notarization and artifact verification scripts.
