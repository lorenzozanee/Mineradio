# Mineradio project manual

## Non-negotiable scope

- Treat the current product as Windows x64 only. The active migration scope is one shared business-code mainline plus Windows x64 and Apple Silicon macOS (`arm64`) platform implementations.
- Deliver an Apple Silicon DMG without regressing the Windows EXE. Do not create separate long-lived Windows and macOS product branches.
- Do not add Linux or Intel macOS implementations, placeholders, build jobs, or speculative abstractions.
- Remove replaced internal paths and update every caller and test. Do not add compatibility exports, fallback imports, duplicate modules, or migrations for obsolete internal paths.
- Preserve unrelated work. Never commit user data, credentials, logs, caches, installers, or generated build output.

## Repository facts: current state

| Area | Current implementation |
| --- | --- |
| Runtime | CommonJS Electron app; `package.json` points `main` to `desktop/main.js`. |
| Main process | `desktop/main.js` owns lifecycle, windows, IPC, local data, login windows, Windows desktop integration, and starts `server.js` on loopback. It is a high-conflict file. |
| Preload | `desktop/preload.js` exposes `window.desktopWindow`; `desktop/overlay-preload.js` exposes `window.desktopOverlay`. Main/overlay windows use `contextIsolation: true`, `nodeIntegration: false`, and currently `sandbox: false`. Login windows use the sandbox. |
| Renderer | `public/index.html` loads vendored classic scripts and `public/js/index-loader.js`, which concatenates ordered files under `public/js/modules/`. There is no renderer bundler or module loader. |
| Shared-looking code | `server.js`, provider APIs, `cuefield/`, `dj-analyzer.js`, most renderer modules, `desktop/local-music-library.js`, and `desktop/login-easter-egg-gate.js`. Audit hidden OS assumptions before classifying them as shared. |
| Windows code | `desktop/full-desktop-mode-runtime.js`, `desktop/desktop-*-runtime.js`, `desktop/wallpaper*-runtime.js`, `desktop/wallpaper-engine-library.js`, `desktop/system-memory.js`, Windows blocks in `desktop/main.js`, PowerShell/live-QA scripts, NSIS files, `build/after-pack.js`, `.ico`/BMP resources, and `rcedit`. |
| macOS code | `desktop/platform/macos/` provides capability/lifecycle and window adapters, a native application menu, Dock activation, native main-window controls, a desktop-lyrics panel, normalized global shortcuts, and explicit unsupported desktop-mode results. No entitlements, icon set, DMG configuration, signing, or notarization workflow exists yet. |
| Tests | Existing tests remain mostly flat and mix `node:test` with self-running assertion scripts. Platform contract tests now live under `tests/contracts/` and `tests/platform/`. `scripts/quick-check.js` still orchestrates selected tests plus extensive source guards. |
| Automation | `test:shared` and `test:platform` exist. No `.github/workflows/`, standard aggregate `test` script, release script, or macOS build script exists. |
| Package manager | npm with `package-lock.json` lockfile version 3. No Node version, lint, formatter, or TypeScript configuration is pinned. |
| Git | `origin` is the project fork. `upstream` is configured as `https://github.com/XxHuberrr/Mineradio.git`; stable baseline `v2.1.0` resolves to commit `96091d123b36783f5604d1acd47b00b0708cabbd`. |

Keep the current entry points working while extracting platform boundaries. Do not mistake the target structure below for code that already exists.

## Commands that exist now

Run commands from the repository root.

| Purpose | Command | Current boundary |
| --- | --- | --- |
| Install | `npm install` | Documented in `README.md`; updates must keep `package-lock.json` synchronized. |
| Run | `npm start` | Runs `electron .`; current application support is Windows. |
| Fast/static check | `node scripts/quick-check.js` | Runs syntax, selected tests, and source guards; it skips Electron runtime smoke. |
| Shared behavior tests | `npm run test:shared` | Runs platform-independent dependency-injection, bounded IPC payload, and external-navigation policy tests without starting Electron. |
| Platform contract tests | `npm run test:platform` | Runs the shared contract plus Windows/macOS adapter, IPC boundary, and renderer capability tests. |
| Windows fast-check wrapper | `quick-check.bat` | Calls the same static check and pauses unless configured otherwise. |
| Windows full smoke | `quick-check.bat full` or `node scripts/quick-check.js --electron` | Requires installed dev dependencies and Windows. The checker currently resolves only `node_modules/electron/dist/electron.exe`; real main-entry recovery is also Windows-only. |
| One `node:test` file | `node --test tests/<node-test-file>.test.js` | Use only for files that import `node:test`. |
| One self-running test | `node tests/<self-running-file>.test.js` | Use for files with their own `main()`/`run()` harness. |
| Windows installer | `npm run build:win` | Builds the x64 NSIS installer to `dist/`; run on Windows for a formal artifact. |
| Windows unpacked app | `npm run build:win:dir` | Builds a Windows directory target. |
| Internal beta installer | `npm run build:win:internal-beta` | Uses `electron-builder.internal-beta.json`; never mix this artifact with a public release. |

Do not claim `npm test`, `npm run smoke:*`, `npm run build:mac`, or a release command exists. The broader migration must still add and document commands for shared behavior, target-OS platform behavior, Electron smoke, and Apple Silicon DMG validation; their exact package-script names are not defined yet.

At the 2026-08-04 inspection, `node scripts/quick-check.js` on macOS with Node 26.4.0 initially failed the first FLAC metadata case because dependencies were absent. After `npm ci`, all six FLAC cases passed; the checker then failed the Wallpaper Engine library path assertion because macOS resolves `/var` to `/private/var`. Record both baselines; do not modify Windows-native assertions to manufacture a macOS pass or claim the full checker is green.

## Target structure: migration requirement

Grow toward this structure only as working, tested slices land:

```text
desktop/
  main.js
  preload.js
  shared/
  platform/
    index.js
    contract.js
    capabilities.js
    windows/
    macos/
build/
  shared/
  windows/
  macos/
tests/
  shared/
  contracts/
  platform/windows/
  platform/macos/
  smoke/windows/
  smoke/macos/
```

- Keep business behavior in shared modules. Let shared code depend only on the platform contract, never on `platform/windows/` or `platform/macos/`.
- Select the platform once in `desktop/platform/index.js` or an equivalent composition root. Do not scatter `process.platform` checks through shared code, preload, or renderer code.
- Keep HWND, WorkerW, Progman, DWM, Wallpaper Engine, PowerShell, registry, and Windows memory helpers under the Windows boundary.
- Keep macOS menu, Dock, Space/window-level behavior, privacy permissions, entitlements, signing, and notarization under the macOS boundary.
- Use `node:path` for paths. Never hand-build `\\` or `/` paths in shared code.
- Use `CommandOrControl` for shared shortcuts. Put genuinely different shortcuts behind tested platform configuration.

## Platform contract and renderer rules

- Define one explicit platform contract before moving large amounts of code. Include lifecycle, window setup, shortcuts, system memory, desktop lyrics, desktop mode, Wallpaper Engine, and cleanup semantics as required by actual callers.
- Publish a serializable capability table. Windows initially reports its verified native capabilities; macOS reports only implemented capabilities. Return a structured `unsupported` result for unavailable operations.
- Gate renderer controls, copy, and states from capabilities. Hide or clearly disable unavailable features; never let a missing platform method fail silently.
- Keep the renderer platform-blind. Access privileged behavior only through narrow preload methods; do not expose `ipcRenderer`, Node modules, filesystem primitives, or native handles.
- Preserve context isolation and disabled renderer Node integration. Treat any sandbox change as a security-boundary change requiring Sol Medium review and tests.
- Validate IPC sender, top-level frame, URL/origin, input type, length, enum, path ownership, and capability before side effects. Return bounded serializable results with stable error codes.
- Keep external navigation denied in the webview and open only validated targets through the main process. Preserve the current trusted loopback main-document checks and narrow permission allowlists.
- Add or change an IPC channel as one reviewed unit: main handler, preload wrapper, renderer consumer, validation, contract test, and cleanup/error behavior.

## Code and dependency rules

- Follow existing JavaScript style: CommonJS in Node/Electron files, two-space indentation, semicolons, single quotes where the surrounding file uses them, descriptive functions, and early returns for guards.
- Preserve the classic renderer module order in `public/js/index-loader.js`. Avoid top-level name collisions because renderer files are concatenated into one script scope.
- Keep components modular and concerns separated. Do not extend `desktop/main.js`, `desktop/preload.js`, or `scripts/quick-check.js` with unrelated platform implementation when a focused module can own it.
- Reuse current dependencies and Node/Electron APIs first. Before adding a dependency, inspect its documentation and lockfile impact and verify macOS arm64, Windows x64, Electron 42 ABI, license, maintenance, and native build/signing behavior.
- Update `package.json` and `package-lock.json` together in one owner-controlled commit. Do not install globally or alter the base environment; use an existing compatible environment or a disposable isolated one and clean it up.
- Do not introduce a formatter, linter, bundler, framework, or configuration layer unless the current task requires it and the PR verifies the whole affected surface.

## Tests and target-OS validation

- Classify each behavior as shared unit, platform contract, Windows platform, macOS platform, Electron smoke, installer smoke, or real-device QA.
- Convert a Windows test to a shared test only when it proves platform-independent behavior. Keep HWND/WorkerW/DWM tests on Windows. Write macOS tests for real macOS behavior; do not mechanically copy Windows tests.
- Test an unsupported macOS capability through the contract result and renderer state, not through a fake successful Windows path.
- Prefer behavior tests with injected dependencies over new source-regex guards. Preserve valuable existing guards until their replacement behavior tests cover the same regression.
- Run shared and contract tests on both target operating systems. Run Windows platform tests and EXE smoke on Windows; run macOS platform tests and DMG smoke on Apple Silicon macOS. Mocks on another OS do not satisfy target-OS validation.
- Isolate Electron smoke `userData`, session data, cache, credentials, and provider state in a disposable owned directory. Never read, overwrite, migrate, or delete the real user profile during tests.
- Record exact commands, host OS/architecture, Node/Electron versions, pass/fail counts, skipped tests, and artifacts. Give every required manual test an explicit written reason and result.
- Introduce dual-platform CI as part of the migration. Build formal EXE and DMG artifacts only on native runners; verify that the macOS runner and output are `arm64`.

## Upstream Tag synchronization

- Establish the latest trustworthy upstream stable Tag and its exact commit SHA before the initial migration. Use older releases only to understand behavior; do not recreate obsolete releases.
- Configure and verify the upstream remote before using these commands; `upstream` does not exist in the current checkout:

```bash
git remote add upstream https://github.com/XxHuberrr/Mineradio.git
git fetch upstream --tags --prune
git rev-parse refs/tags/<old-tag>^{commit}
git rev-parse refs/tags/<new-tag>^{commit}
git merge-base --is-ancestor <old-sha> <new-sha>
git log --reverse --oneline <old-sha>..<new-sha>
git diff --name-status <old-sha> <new-sha>
git diff --stat <old-sha> <new-sha>
git diff --find-renames <old-sha> <new-sha>
```

- Stop automatic synchronization if the old Tag is not an ancestor of the new Tag. Review the fork point and Tag objects manually.
- Inspect the complete Tag snapshots, renames, deletions, tests, dependencies, lockfile, build files, and Windows assumptions; do not rely on release titles or commit subjects.
- Classify every change as `shared`, `windows`, `macos-impact`, `renderer`, `build`, `test`, or `docs`. Maintain an upstream-commit-to-local-change/no-action/platform-alternative map.
- Create later synchronization branches from this repository's `main`, not from an upstream Tag, so the platform foundation remains intact. Use `sync/upstream-<tag>` plus isolated `port/<tag>-<area>` worktrees.

## Multi-agent execution and ownership

- Use one coordinating/integration Agent throughout. With four concurrency slots, run at most three subagents in parallel.
- Phase work in this order: (A) baseline/diff audit, contract, and test design; (B) shared, Windows, and macOS implementation; (C) renderer capability UX, test orchestration, and CI/build; (D) independent Windows QA, macOS ARM64 QA, and release-security review of the same candidate SHA.
- Freeze the first platform contract before broad file movement. Merge by dependency order, not Agent completion time. Keep every integration-branch commit within the current phase's passing gate.
- Give every implementation Agent its own branch and worktree plus an exclusive file list. Let the integration Agent wire shared entry points, resolve conflicts, run final checks, and own the merge.
- Never let multiple Agents concurrently edit `desktop/main.js`, `desktop/preload.js`, `package.json`, or lockfiles. Treat `server.js`, `scripts/quick-check.js`, `public/index.html`, and `public/js/index-loader.js` as additional high-conflict files and assign one owner per phase.

| Area | Owner |
| --- | --- |
| `desktop/main.js`, `desktop/preload.js`, platform contract/loader, final IPC wiring | Integration Agent |
| `desktop/shared/`, shared APIs, pure business modules | Shared implementation Agent |
| `desktop/platform/windows/`, PowerShell/Windows helpers | Windows platform Agent |
| `desktop/platform/macos/`, macOS resources | macOS platform Agent |
| Capability-driven renderer UI and copy | Renderer UX Agent |
| Shared/contract/smoke orchestration | Test architecture Agent; it must not implement the behavior it is proving |
| `.github/workflows/`, builder configuration, build resources, release scripts | Build/signing Agent; package and lockfile changes go through the Integration Agent |
| Release integrity decision | Independent release-security Agent; it must not repair its own findings |

## Model routing

- Use Luna High for mechanical, bounded, automatically verifiable work such as inventories, path updates, directory moves, and hashes.
- If the subagent API cannot select Luna, use Terra Medium or Terra High for that bounded work.
- Use Terra High for general design and implementation, Tag-diff classification, test conversion, shared extraction, renderer capability work, and CI configuration.
- Use Sol Medium for platform contracts, IPC/preload security, native-system issues, `main.js` integration, signing/notarization, difficult conflicts, and release-security decisions.
- Use Sol Light only for small, bounded reviews. Do not let it make an independent release decision.
- Never use Sol High or XHigh. Escalate ambiguity by narrowing scope, adding tests, or routing to Sol Medium, not by increasing beyond Medium.

## Security, privacy, and provider boundaries

- Keep cookies, tokens, QR/login state, Spotify credentials, playback/search history, local music, covers, lyrics, caches, journals, and startup diagnostics under isolated local user data. Never add them to fixtures, commits, PRs, issues, logs, screenshots, build context, or release artifacts.
- Honor `.gitignore` and scan staged changes and packaged contents for `.cookie`, `.qq-cookie`, `.kugou-cookie`, `.qishui-*`, `.spotify-*`, `.env*`, tokens, absolute user paths, logs, and local media.
- Never use real user data for development or QA. Use synthetic accounts/data or explicitly isolated disposable profiles.
- Keep signing certificates, Developer ID credentials, notarization credentials, and provider secrets only in protected CI secrets. Never expose secrets to fork PRs or untrusted `pull_request_target` code.
- Preserve third-party service boundaries. Do not bypass payment, membership, DRM, rate limits, authentication, or provider terms; do not redistribute music or private provider data.
- Keep update and external-page inputs HTTPS, bounded, allowlisted or provider-derived as appropriate, and main-process validated. Do not reintroduce silent local installer downloads or patch application.
- Do not weaken NSIS path ownership and uninstall safeguards. Never restore recursive deletion of an installation root.

## PR, Git, and review standards

- Keep each PR scoped to one migration slice. State the upstream Tag/SHA or local requirement, capability changes, owned files, current-versus-target command status, risk, and rollback behavior.
- Include shared/contract/platform/smoke evidence as applicable. Identify target-OS checks that remain manual; do not substitute cross-OS mocks.
- Require Integration Agent review for platform contracts, `main.js`, preload, IPC, package/lockfile, and cross-agent merges. Require independent platform review for native behavior and independent security review for release changes.
- Review the final diff and `git status`. Stage only task-related verified files. Do not stage unrelated user changes, generated files, secrets, conflicts, or failing work.
- After successful verification, commit with a concise message and push the current branch. If checks fail or push is unsafe, do not claim completion; report the exact command, failure, and unpushed commit state.
- Do not create or move a formal Tag as part of an ordinary feature PR.

## Native build, signing, QA, Tag, and Release gates

Pass the gates in order for one exact candidate commit SHA:

1. Freeze the upstream Tag/SHA, record the Windows baseline, and close the capability/dependency/risk inventory.
2. Pass shared and contract tests on Windows and macOS; preserve Windows behavior and explicit unsupported semantics.
3. Pass target-platform tests and Electron renderer plus real-main-entry smoke with disposable user data.
4. Build the formal Windows x64 EXE on Windows and the formal `arm64` DMG on Apple Silicon macOS from clean checkouts of the same SHA.
5. On Windows, run `rcedit` resource modification first, sign the main EXE second, build NSIS third, and sign the installer last. Verify Authenticode on both EXE and installer.
6. On macOS, use Developer ID Application signing, Hardened Runtime, minimum entitlements, notarization, and stapling. Verify architecture, codesign, notarization ticket, Gatekeeper, DMG mount, drag to Applications, and first launch.
7. Install and smoke-test both artifacts. Independently QA playback, lyrics, local library, persistence, shortcuts/media keys, audio devices, multi-display/fullscreen, sleep recovery, Windows desktop mode, and macOS menu/Dock/Space behavior.
8. Have Windows QA, macOS ARM64 QA, and release-security review the same SHA and candidate artifacts. Verify checksums, manifest, dependency boundary, and absence of secrets, user data, absolute local paths, or stale `dist/` content.
9. Only after every gate passes, create an immutable annotated formal Tag on that exact SHA. Use project Tags distinguishable from upstream Tags, create a new RC on failure, and never move or rewrite a published Tag.
10. Attach the already-approved artifacts to a Draft Release through one publisher job, verify Tag/artifact/SHA identity, and then publish. Never rebuild or replace artifacts after approval without repeating the gates.

Do not create or push a formal Tag before native builds, signing, installation smoke tests, and independent QA all pass for the same commit SHA.

## Completion criteria

- Complete only the requested scope and remove obsolete internal paths introduced by that scope.
- Pass the smallest relevant checks plus the required shared, contract, platform, smoke, build, signing, install, and QA gates for the change class.
- Verify unsupported capabilities, renderer states, IPC validation, cleanup, and error semantics.
- Confirm documentation labels current commands and future requirements accurately.
- Confirm `git diff --check`, inspect the diff, verify `git status`, stage only owned task files, commit, and push the current branch.
- Report any unverified OS, native hardware, signing, provider, CI, or release fact explicitly. Never infer a pass from code inspection alone.
