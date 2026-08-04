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

Current local evidence is for candidate `macos` commit `09e279c` plus the
cross-platform check-orchestration fixes in the working tree:

- `npm test`: 171 passed, 0 failed (87 shared core, 13 shared legacy,
  58 platform/contract, 13 build).
- `npm run test:smoke:macos`: 16 smoke-helper tests passed and the real arm64
  Electron main-entry smoke passed with an owned disposable profile.
- `npm run build:mac:unsigned`, `npm run validate:mac:unsigned`, and
  `npm run test:smoke:macos:package` passed (6 packaged smoke tests). The
  verified artifact is an unsigned local arm64 DMG, not a release candidate.
- `node scripts/quick-check.js` passes on macOS. The Wallpaper Engine native
  runtime fixture is explicitly skipped because it validates Windows process
  launch and command-line semantics; the cross-platform library fixture and all
  source guards still run. The fixture expected paths use `realpathSync`, so
  macOS `/var` → `/private/var` canonicalization is tested correctly without
  changing Windows behavior.
- The protected release path now has a manifest-producing native validation
  job and a manual `release-publisher.yml` that verifies the completed run SHA,
  success conclusion, artifact names/checksums, QA/security attestations, and
  tag uniqueness before creating an annotated Tag and Draft Release. The
  publisher never invokes a build; protected GitHub credentials and actual QA
  approvals are still required before it can run.
- Visible Apple Silicon QA covered first launch, native traffic lights, native
  menu, WebGL main scene, macOS fullscreen Space entry/exit, and `Cmd+Q` using
  an owned disposable profile. No provider login or real user data was used.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- `node scripts/quick-check.js` reaches the Windows Wallpaper Engine fixture
  assertion and fails only because macOS canonicalizes `/var/...` as
  `/private/var/...`. The Windows-native assertion remains unchanged; this is
  not evidence of Windows runtime validation.

## Capability matrix

| Area | Shared | Windows x64 | macOS arm64 |
| --- | --- | --- | --- |
| Provider APIs, playback, queues, lyrics rendering, visual state | Shared and covered by injected/contract tests | Existing behavior preserved | Source and packaged arm64 smoke passed; provider login remains real-device QA |
| Local music library | Shared persistence and metadata implementation | Existing behavior | Unicode metadata, isolated startup, and packaged-app smoke passed |
| Main lifecycle | Platform composition root | Existing close behavior | Dock activation, native menu, disposable-profile startup and clean quit verified |
| Main window | Shared creation plus platform options | Existing frameless window retained | Opaque hidden-inset native title bar, traffic lights, and fullscreen Space verified |
| Desktop lyrics | Shared state and renderer | Existing Windows native behavior | Native panel/all-Spaces contract tested; real-device interaction QA remains |
| Global shortcuts | Platform service behind shared action model | Existing behavior | Command-oriented registration and unsupported-action tests passed; media-key QA remains |
| System memory snapshot | Contract service | Existing Windows implementation | Bounded read-only snapshot implemented and tested |
| App/system memory trimming | Platform-specific operation | Existing PowerShell implementation | Explicit unsupported result and renderer gating tested |
| Full desktop mode | Platform-specific operation | Existing HWND/WorkerW/Progman/DWM implementation | Explicit unsupported result and renderer gating tested |
| Wallpaper Engine | Platform-specific operation | Existing Steam/registry/DWM/window runtime | Explicit unsupported result and renderer gating tested |
| Tray/status-item close behavior | Platform-specific operation | Existing tray behavior preserved behind the adapter | Native macOS status item (`Show/Hide/Quit`) and tray-to-exit normalization tested |
| Installer/build | Shared metadata plus platform builder config | Existing x64 NSIS configuration retained | arm64 DMG, `.icns`, hardened entitlements, isolated package smoke and DMG validator implemented |
| Signing/release | Shared integrity gates | Native artifact/QA still required | Developer ID, notarization, stapling, Gatekeeper and independent QA still require protected credentials and release hardware |

## Current security and architecture risks

1. Formal Windows and macOS artifacts still must be built, signed where
   required, installed, and independently QA'd on native target environments
   from one exact candidate SHA. Local mocks and macOS-only runs are not release
   evidence for Windows.
2. No Developer ID identity or Apple notarization credentials are present on
   this development host. `build:mac:unsigned` deliberately cannot establish
   codesign, stapling, Gatekeeper, or quarantine first-launch evidence.
3. The cross-platform CI workflow runs on pull requests and pushes to `main`,
   `macos`, or `codex/macos`; native package validation is deliberately manual
   and protected by the `release-signing` environment.

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
