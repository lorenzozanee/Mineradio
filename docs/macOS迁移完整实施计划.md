# Mineradio Apple Silicon macOS 完整实施计划

> **计划版本**：1.1（执行状态更新）
> **编制日期**：2026-08-04
> **实施基线**：`main` = `89c0d230c3f1f792e5d9639781ebbf724c4efbfe`；当前迁移候选分支 `macos` = `7743fd8`；最新已验证双平台 CI 候选 = `7743fd85c998c59fbe001ce71b01b4f5806b6dfc`（run `30894875487`）；可信上游稳定版 `v2.1.0` = `96091d123b36783f5604d1acd47b00b0708cabbd`
> **依据**：[Windows 向 macOS 迁移功能和界面丢失审计](Windows向macos迁移功能和界面丢失.md)、`AGENTS.md`、`package.json`、现有平台实现、构建脚本、CI 和测试。
> **执行约束**：本计划交付给实施 Agent。每一个实现阶段均须独立提交并推送候选分支；在同一候选 SHA 的原生构建、签名、公证、安装 QA 和独立安全审查全部通过前，禁止合并 `main`、创建正式 Tag 或发布。

## 1. 目标、最终交付与不可变边界

### 1.1 目标

在一条共享业务主线上完整交付 Apple Silicon (`arm64`) macOS 应用，同时保持 Windows x64 的已有功能、构建路径、测试和安装器语义不回归。完成后，macOS 用户可获得一个具备原生窗口、菜单栏/Dock、桌面歌词、快捷键、登录、本地曲库、播放/视觉功能、安全本地数据目录、签名并公证的可分发 DMG；Windows 继续以现有 NSIS EXE 为正式产物。

### 1.2 最终交付物

1. 一个可在 macOS arm64 与 Windows x64 上运行的同一业务代码主线，平台特性仅经 `desktop/platform/` 契约调用。
2. 完整的能力矩阵、IPC/preload/renderer 能力门控和 macOS 原生替代体验；Windows-only 功能返回可序列化 `unsupported`，不模拟成功。
3. 全部共享业务测试进入双平台 CI；Windows-only 测试保留在 Windows，不被为 macOS 修改或弱化；新增必要 macOS 平台、烟雾、崩溃恢复、菜单栏、更新路径和高价值 IPC 合约测试。
4. Apple Silicon 原生 DMG：`.icns` 图标、品牌 DMG 拖拽安装界面、Developer ID 签名、Hardened Runtime、最小 entitlements、公证、staple、Gatekeeper/架构/内容卫生验证。
5. 同 SHA 的 Windows x64 NSIS EXE 与 macOS arm64 DMG 原生构建、安装冒烟、独立 QA、安全/发布审查证据；审核后以已构建产物创建 annotated Tag 和 Draft Release。
6. 实施与验收文档更新，包括准确命令、已验证环境、未验证限制、能力差异和发布证据。

### 1.3 范围内功能

| 域 | macOS 应交付的行为 |
|---|---|
| 共享产品能力 | 多 Provider 播放、队列、Web Audio/视觉预设、3D 歌单架、天气电台、歌词、搜索、账户登录、缓存、偏好、本地音乐库、外部更新页和安全导航，与 Windows 共用同一 renderer/server 业务逻辑。 |
| 窗口与系统集成 | 原生红绿灯、原生应用菜单、Dock 激活、macOS 全屏/Space、桌面歌词 `panel`、全局快捷键和状态栏菜单栏项。 |
| 安装与分发 | 仅 arm64 DMG，拖至 Applications，签名、公证、staple、Gatekeeper 通过。 |
| 可靠性与安全 | 隔离 userData、权限描述、受信 IPC、路径/URL/payload 校验、无凭据或用户文件进入产物/日志。 |

### 1.4 明确不实现为 macOS 等价物的 Windows-only 功能

以下项目不是“遗漏”，必须保持 capability 为 `false`，并让 UI 隐藏/禁用且 IPC 返回稳定的 `PLATFORM_CAPABILITY_UNSUPPORTED`：

| Windows 能力 | Windows 实现位置 | macOS 决策与替代 |
|---|---|---|
| Wallpaper Engine、Steam/注册表、`mineradio-wallpaper:` 协议 | `desktop/wallpaper-engine-*`、`desktop/wallpaper-engine-library.js` | 不可用；保留应用内视觉效果，不提供 Wallpaper Engine 入口或伪造运行时。 |
| WorkerW/Progman/DWM 全桌面模式、桌面图标层、HWND 嵌入 | `desktop/full-desktop-mode-runtime.js`、`desktop/desktop-*-runtime.js` | 不可用；使用普通原生窗口和 macOS 全屏 Space，不把窗口嵌入 Finder 桌面。 |
| PowerShell/WMI/Windows 工作集/系统 purge、管理员 token | `desktop/platform/windows/system-memory.js` | 不可用；macOS 仅提供 `os`/`process` 内存快照，不请求提权或清理系统内存。 |
| NSIS、rcedit、`.lnk`、注册表卸载路径 | `build/installer.nsh`、`build/after-pack.js` | 不可用；DMG + `/Applications` 拖放安装、移入废纸篓卸载。 |

**例外：系统托盘不是 macOS 无法实现的能力。** Electron 在 macOS 可使用 `Tray` 映射为原生状态栏 `NSStatusItem`。本计划将其实现为 macOS 菜单栏项，而不是 Windows 托盘的视觉复制，以解决遗留 `closeBehavior: 'tray'` 的真实关闭路径问题。

## 2. 当前结构、状态与架构约束

### 2.1 当前事实

| 区域 | 当前状态 | 实施含义 |
|---|---|---|
| 入口 | CommonJS Electron，`desktop/main.js` 创建窗口、生命周期、登录、IPC、桌面歌词、本地数据并启动 loopback `server.js` | `main.js` 是集成热点，只由主集成 Agent 修改。 |
| 平台层 | `desktop/platform/index.js` 选择 `windows`/`macos`；`contract.js` 当前封装 lifecycle/runtime/shortcuts/systemMemory/window/desktopMode；capabilities 仅有 `fullDesktopMode`、`wallpaperEngine`、`tray` | 所有新增系统能力先扩展契约和 capability，再接 IPC/preload/renderer。 |
| macOS | 已有菜单、Dock、红绿灯、globalShortcut、系统内存快照、桌面歌词 `panel`、unsupported native desktop features、DMG 构建和 smoke | 不能推倒重写；以缺口切片补齐。 |
| Windows | 现有 Windows 原生模块、NSIS、rcedit、快速检查和 Windows 测试保持权威 | 不改 Windows 实现或 Windows 专属测试，除非 Windows 自身发现独立 bug 并有 Windows 验证。 |
| Renderer | 无 bundler；`public/index.html` 通过 `public/js/index-loader.js` 串接经典脚本 | 保持模块顺序；不得在顶层引入名称冲突或 Node API。 |
| 构建 | `build:mac` 为签名 arm64 DMG，`build:mac:unsigned` 为本地验证；`build:win` 为 x64 NSIS | 不把 macOS 签名选项、图标、发布设置写进 Windows builder 配置。 |
| CI | `cross-platform-ci.yml` 已在 `windows-2025` 和 `macos-15` 跑 shared/platform/build；native manifest 与零重建 publisher 已在候选分支实现 | native/publisher workflow 仍须由维护者按默认分支保护策略暴露后，才能使用签名环境 dispatch。 |

### 2.2 架构目标与接口规则

```text
renderer classic modules
  -> window.desktopWindow (narrow preload API)
  -> trusted IPC handler + payload/policy/window authorization
  -> desktop/platform contract (one composition root)
  -> windows native implementation | macOS native implementation
```

- 共享业务模块、renderer、preload 不得直接 `require` Windows/macOS 文件，也不得散落 `process.platform`。
- 所有平台结果使用有界、可 JSON 序列化的对象。成功：`{ ok: true, ... }`；未支持：`{ ok: false, unsupported: true, capability, operation, error: 'PLATFORM_CAPABILITY_UNSUPPORTED', status }`；输入错误：稳定错误码，不抛给 renderer。
- 每个新增 IPC 通道必须同时具备：主进程 handler、preload 窄包装、renderer 调用/能力门控、trusted sender/URL/top-frame 校验、payload 长度/枚举校验、契约测试和清理语义。
- 保持 `contextIsolation: true`、renderer `nodeIntegration: false`。不因 TCC、登录、自动更新或测试放宽 sandbox/权限。
- Apple Silicon 是唯一 macOS 架构目标。不得添加 Intel macOS、Universal 或 Linux 占位实现。

### 2.3 高冲突文件与所有权

| 文件/目录 | 唯一修改者 | 协作规则 |
|---|---|---|
| `desktop/main.js`、`desktop/preload.js`、`desktop/platform/index.js`、`contract.js`、`capabilities.js`、`package.json`、`package-lock.json` | 主集成 Agent | 不与其他 Agent 并行编辑。 |
| `desktop/platform/macos/`、`build/macos/` | macOS 实现/构建 Agent | 只能通过契约接口接入。 |
| `desktop/platform/windows/`、`build/after-pack.js`、NSIS、Windows 原生 tests | Windows Agent/只读保护 | 本迁移默认只验证，不改动。 |
| `public/index.html`、`public/css/index.css`、`public/js/modules/` | renderer Agent | 只处理 capabilities 驱动 UI 和 macOS 原生文案。 |
| `tests/`、`.github/workflows/` | 测试/CI Agent | 不实现被测试的业务行为；高冲突清单仍由集成 Agent 落地。 |

## 3. 实施顺序与任务分解

每个阶段开始前记录输入 SHA、工作树、Node/Electron 版本和命令输出；阶段结束时运行该阶段门禁、`git diff --check`、敏感信息扫描、定向 diff 审查、单独提交并推送。完成状态只能在证据完整后更新。

### 阶段 0：冻结事实、测试分类与执行基线

**输入**：当前 `macos` 候选分支，`main` 及上游 `v2.1.0`。
**输出**：可重复执行的基线记录与测试分类表；不改变业务行为。

1. 重新确认 `upstream` remote、`v2.1.0^{commit}`、`main` 和候选分支 SHA；使用 `git merge-base --is-ancestor` 验证基线祖先关系。
2. 以文件为单位将当前测试分为：
   - **shared node:test**：`external-update-page-bridge`、首页推荐/仪表盘/hero、汽水 QR/权益、搜索分页、默认主题、外部更新等 10 个；
   - **shared self-running**：播放图恢复、播放源回退、Provider/VIP/账户/启动就绪等 12 个；
   - **live/provider smoke**：`qishui-passport-live-smoke.js`，默认不进 CI，必须显式凭据和隔离环境；
   - **Windows-only**：`full-desktop-mode-runtime`、`desktop-icon-shape-runtime`、`desktop-native-icon-layer-runtime`、Wallpaper Engine idle dispose，以及仅验证 Windows 源码守卫的部分测试；
   - **macOS contract/platform/smoke/build**：现有 `tests/contracts/`、`tests/platform/macos/`、`tests/smoke/macos/`、`tests/build/`。
3. 在 `docs/CROSS_PLATFORM_BASELINE.md` 追加事实化表格：命令、主机 OS/arch、Node、Electron、测试通过/失败/跳过、产物路径与失败原因。不得把 macOS `/private/var` 与 `/var` 的 Wallpaper Engine 路径 guard 失败记为全套成功；该 guard 是 Windows 专属，后续仅在 Windows quick-check 中执行。
4. 检查 `npm ci`、`npm audit --omit=dev`、`npm test`、`npm run test:smoke:macos`、`npm run build:mac:unsigned`、`npm run test:smoke:macos:package`、`npm run validate:mac:unsigned`。Windows 原生步骤仅在 Windows 机器/runner 执行，不能由 macOS mock 替代。

**完成标准**：基线文档包含真实结果；不存在将 Windows-only 测试误设为 macOS 测试，或将 live 测试放入无凭据 CI。

### 阶段 1：恢复全部共享业务回归门禁（P0）

**输入**：阶段 0 分类结果。
**输出**：所有可离线运行的共享业务测试在两个目标 OS 的 CI 上执行。

1. 在 `package.json` 定义三层命令，且同步更新 `package-lock.json`（若仅脚本改动仍核对 lockfile 未被误改）：
   - `test:shared:core`：当前 9 个 shared/contract 基础测试加上 10 个可直接用 `node --test` 执行的原有 shared node:test 文件；
   - `test:shared:legacy`：显式顺序运行 12 个自运行 shared 测试，遇到非零退出立即失败；不使用 glob 以免误把 Windows/live 文件纳入；
   - `test:shared`：依次执行 core 与 legacy；`test` 仍按 `test:shared` → `test:platform` → `test:build` 聚合。
2. 不转换 Windows-only 测试，不修改其断言；不把 `qishui-passport-live-smoke.js` 加入默认脚本。为 live smoke 增加仅在 `MINERADIO_LIVE_PROVIDER_SMOKE=1` 时允许执行的独立命令，并要求临时 profile 和显式、非提交的测试凭据。
3. 若任一历史 shared 测试因 macOS 路径、CRLF、临时目录或 API 输出差异失败，先判断它是共享语义还是 Windows 原生语义：
   - 共享语义：在测试 fixture/assertion 中用 `path.join`、规范化换行或平台无关的临时目录表达；
   - Windows 原生语义：移至 Windows-only 脚本并在 macOS 明确跳过原因；
   - 禁止删除断言、扩大 mock、修改 Windows test 以制造 macOS 通过。
4. 更新 `cross-platform-ci.yml`，在两个 OS 上执行新 `npm run test:shared`；保留 secrets-free `pull_request` 和 SHA 固定 actions。

**测试/验收**：`npm run test:shared` 在 macOS 与 Windows CI 均通过；运行日志列出 core/legacy 项；Windows-only 与 live 文件不在默认命令；测试失败可定位到单文件。

### 阶段 2：补齐平台能力与关闭行为（P0）

**输入**：现有 3-key capability 表、遗留可能持久化 `closeBehavior: 'tray'` 的用户配置。
**输出**：macOS 使用原生状态栏菜单，关闭行为稳定，旧配置不会导致不可恢复的隐藏窗口。

#### 2.1 扩展平台契约

1. 将 capability 保持为显式枚举，新增 `statusItem`（或将现有 `tray` 的定义改为“系统状态栏/托盘可用”，二选一且全仓统一）。本计划采用**保留 `tray` 键但重新定义为 Electron 原生状态栏/系统托盘能力**，避免 renderer/preload 新旧兼容层；Windows 和 macOS 都报告 `tray: true`，仅 Linux 不支持。
2. 在 `desktop/platform/contract.js` 新增 `tray` service，最小接口：
   - `createOrUpdate(options)`：创建或更新原生项；
   - `destroy()`：幂等释放；
   - `isAvailable()`：仅返回 capability 对应状态。
   所有返回值统一为有界对象；不把 Electron `Tray` 实例暴露给 renderer。
3. 在 `desktop/platform/windows/index.js` 由现有 tray 行为适配该 service；保持当前菜单、EXE 图标和 close-to-tray 行为不变。Windows 改动须最小且在 Windows CI/真机验证。
4. 在 `desktop/platform/macos/` 新建 focused `status-item.js`：使用 Electron `Tray` + `Menu.buildFromTemplate`，图标使用 template PNG/`nativeImage`，菜单至少有“显示 Mineradio”“隐藏 Mineradio”“退出 Mineradio”。点击显示时恢复/聚焦主窗口；不要暴露 Windows 的“退出桌面模式”菜单项。Dock 行为继续由 lifecycle 管理。
5. macOS 状态栏图标需使用 monochrome template asset（例如 `build/macos/status-itemTemplate.png` 和 `@2x`），打包时包含但不进入 renderer。`Tray.setImage` 失败必须返回 `STATUS_ITEM_IMAGE_FAILED`，不使主窗口崩溃。

#### 2.2 关闭状态机与 IPC

1. 将 close behavior 规范化为 `exit | tray` 两个持久值；不新增无意义的 `hide` 配置值。`tray` 在 capability 为真时调用平台 `tray.createOrUpdate` 再隐藏主窗口；失败时返回 `CLOSE_BEHAVIOR_TRAY_UNAVAILABLE` 并**安全降级为 `exit`**，不可静默悬挂。
2. `desktop-window-set-close-behavior` 必须验证顶层受信 main frame、字符串类型、长度、枚举和 capability；当不支持 tray 时拒绝 `tray` 并返回当前有效行为。遗留存储值在应用启动恢复时按同一 normalize 函数处理。
3. `desktop-window-close`、窗口 `close` 事件、`window-all-closed`、Dock `activate`、菜单“显示”、菜单“退出”、`before-quit` 必须共享同一个幂等状态机：
   - 用户请求关闭且有效值 `exit`：标记 `appQuitting` 并 `app.quit()`；
   - 用户请求关闭且有效值 `tray`：`preventDefault()`，隐藏窗口，状态栏菜单保持可见；
   - 显式退出：销毁 tray/status item，清理快捷键、desktop lyrics、IPC 和 native runtimes 后退出；
   - macOS `window-all-closed` 不退出；点击状态栏/ Dock 恢复时只创建一个主窗口。
4. renderer 不依赖平台字符串。已有 `data-platform-capability="tray"` 控件在 macOS 将正常显示，并将文字改为“关闭后保留在菜单栏”；Windows 保持“后台托盘”。通过 `data-platform="darwin"` CSS/文案映射实现，不复制页面。

#### 2.3 测试

- `tests/contracts/platform-contract.test.js`：service 签名、unknown capability 拒绝、snapshot；
- `tests/platform/windows/platform.test.js`：Windows capability/adapter 不变；
- 新增 `tests/platform/macos/status-item.test.js`：菜单模板、template image、show/hide/quit、无 Dock/Tray API 时稳定错误、destroy 幂等；
- 新增 `tests/contracts/close-behavior-platform.test.js`：不可信 sender、非法值、macOS legacy tray、tray 创建失败降级、Windows tray 保持、before-quit cleanup；
- 扩展 macOS source/packaged smoke：首次启动 → 设置 tray close → 关闭主窗 → status item show → Cmd+Q 完整退出；所有 profile 位于 owned temp 目录。

**完成标准**：macOS 关闭不会产生无菜单栏的不可恢复后台进程；Windows close-to-tray 语义和 Windows 测试不回归；每条 IPC 均有输入和授权边界测试。

### 阶段 3：完善 macOS 原生 UI、资源与桌面歌词（P1）

**输入**：现有 `titleBarStyle: 'hiddenInset'`、原生菜单/Dock、歌词 `panel`。
**输出**：Retina 清晰资源、合规 DMG 拖放体验、可验证的原生窗口/歌词行为。

1. **应用图标**：从现有有权使用的高分辨率原始图生成 `build/icon.icns`，使用 `iconutil` 生成标准 `icon_16x16` 至 `icon_512x512@2x` iconset；不从有损小 PNG 放大。`build/macos/configuration.js` 的 mac icon 改为 `.icns`。新增 build test 验证图标文件存在、iconset/ICNS 可读，DMG 中 `.app/Contents/Resources` 存在有效图标引用。
2. **DMG 背景**：创建 `build/macos/dmg-background.png`（固定尺寸、只包含品牌和“拖动到 Applications”引导，不含用户数据、绝对路径、许可证不明素材），在 `dmg` 配置设置 `background`、窗口尺寸、图标大小、图标坐标；保持 `Mineradio.app` 和 `/Applications` symlink。扩展 `validate-dmg.js` 仅验证布局文件和 link，不以截图像素替代 Finder 真机检查。
3. **窗口**：保持 macOS `frame: true`、不透明背景、`hiddenInset`、traffic lights、`fullscreenable: true`；不得恢复 Windows 的透明无框配置。新增真实 macOS smoke/QA 检查进入/退出原生 full screen 后无白屏、无裁切、菜单项正确、F 或原生控制返回窗口模式。
4. **菜单/Dock**：扩充 `application-menu.js` 中 macOS 惯例项（About、Hide、Hide Others、Quit、Edit standard actions、Window Minimize/Zoom/Bring All to Front），菜单 action 只调用 Electron role 或已有受信主进程动作。测试每个 template role 和状态栏菜单不冲突。
5. **桌面歌词**：保持 `panel`、`hiddenInMissionControl`、`setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`。不将 macOS level 设为 Windows `screen-saver`。真实 Apple Silicon QA 必测普通桌面、多个 Space、全屏 app、Mission Control、外接显示器、锁定/点击穿透/拖动/播放进度更新；若 macOS 合法 API 无法达到跨任意第三方 full-screen app 覆盖，记录为平台限制，保持安全 `floating` 行为。
6. **输入与可访问性**：在真实 macOS 验证中文/日文/韩文 IME composition、不拦截 menu/快捷键文本输入、VoiceOver 可读原生标题栏/菜单和主要隐藏/禁用态。只修复实际跨平台 renderer 问题，不能为此改 Windows UI。

**完成标准**：arm64 `.app` Dock/Finder 图标清晰；DMG 挂载呈现可理解的拖放安装；窗口、全屏、Dock、菜单、歌词 QA 逐项记录，未知/不支持情况有理由和产品可接受结论。

### 阶段 4：完整功能链路、崩溃恢复与 IPC 覆盖（P1/P2）

**输入**：已有 trusted IPC 框架、平台 IPC 和 shared server。
**输出**：所有跨平台用户路径在 macOS 有相应自动测试或明确的原生手工 QA；关键 IPC 不仅有策略存在性测试。

1. **渲染进程恢复**：新增 `tests/smoke/macos/renderer-crash-recovery.test.js`，使用隔离 Electron profile 启动真实主入口，模拟 renderer `render-process-gone`/加载失败并验证：单次恢复、无 Windows full desktop/Wallpaper Engine 调用、无重复窗口/服务器/快捷键，恢复后平台 capabilities、菜单栏项、桌面歌词状态一致。不能沿用 `main-window-runtime-recovery.test.js` 中 Windows 源码正则断言。
2. **高价值 IPC contract**：分别为 local music library、desktop lyrics、global hotkeys、close behavior、cache/export/import 建立契约测试。每组覆盖：可信 main/overlay sender、被拒绝的 subframe/非 loopback URL、payload 类型/最大长度/最大数组或对象深度、path ownership、capability、正常结果、稳定错误码、cleanup 后 handler 已移除。测试应注入 `ipcMain`、窗口与平台依赖，不写实际用户目录。
3. **本地曲库与数据路径**：在 macOS 真机和自动测试验证 FLAC/MP3 Unicode metadata、封面、LRC、可选大小写路径、`userData` 下 cookie/cache/beatmap、本地库导入导出、无 app bundle 写入。所有临时媒体必须 synthetic，并在 owned temp 目录清除。
4. **登录与 Provider**：对网易、QQ、酷狗、汽水、Spotify 做无真实账号的窗口/会话契约 smoke（受信 URL、partition、Cookie 清理、cancel/error 路径）；在独立 macOS QA checklist 做人工登录、重启持久化、注销和拒绝权限。不得把真实 Cookie、QR 内容、token、provider 日志放进仓库、CI artifact 或文档。
5. **播放、搜索、首页、视觉**：阶段 1 纳入的 22 个离线 shared tests 是自动回归底线；另在 macOS packaged app 执行 synthetic playback、队列、歌词、搜索、天气首页、视觉预设切换、WebGL fallback、沉浸模式、快捷键/媒体键。音频设备/AirPods 由真机 QA 验收，不伪造 CoreAudio 枚举实现。
6. **更新路径**：维持现有外部 Release 页面/完整 DMG 下载模式，不实现未授权的自修改 patch、静默安装或对 macOS 的 `.patch`。为 `server.js` 更新逻辑添加 macOS 路径 contract：版本/URL/digest 输入合法、只允许 HTTPS/受信 release 目标、没有 patch 时提示下载完整 DMG、下载完成后只向用户提供挂载/拖拽 Instructions。真实 QA 验证在隔离目录下载、DMG mount、替换到 Applications 后新版本启动；不得覆盖运行中的 app 或用户 profile。
7. **权限/TCC**：保留最小 `entitlements.plist`（仅 Electron JIT 例外）。相机/麦克风 usage description 与实际手势/音频功能保持一致；新增 build/source test 保证 helper `Info.plist` 同样具备描述。通过真机验证未使用功能不触发权限框、拒绝权限后功能可恢复且不崩溃。不要添加 app sandbox、disable-library-validation、get-task-allow 或 unlimited memory entitlement。

**完成标准**：所有新增 smoke 用 disposable userData/session/cache；关键 IPC 有正/负向 contract；更新不产生自更新/签名绕过；可自动化与必须真机验证的项目在 QA 表中清楚分隔。

### 阶段 5：签名、公证、原生候选构建与发布机制（P0）

**输入**：阶段 1–4 候选 SHA、有效 Apple Developer 组织权限、受保护 GitHub Environment。
**输出**：不泄露凭据的签名/公证 DMG 与同 SHA Windows EXE，随后由已验证 artifact 创建 Draft Release。

#### 5.1 依赖、配置与本地验证

1. 将与 Electron 42/electron-builder 26 兼容的 `@electron/notarize` 加入 `devDependencies`，通过 `npm install --save-dev @electron/notarize` 生成同步 `package-lock.json`。先检查维护状态、license、lockfile diff；不全局安装。
2. 继续使用 `build/macos/notarize.js` 的 API key 三元组：`APPLE_API_KEY`（临时 `.p8` 路径）、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`。只有非 unsigned build 且 `.app` 存在时调用 `notarize`；不传递无关环境变量；notary 失败必须使构建失败。
3. 保持生产 `build:mac` `forceCodeSigning: true`，本地 unsigned 仅为 `MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD=1` 且非 CI 的 `build:mac:unsigned`。任何 CI unsigned opt-out 均失败。生产 DMG 不设置 `identity: null`，不使用 adhoc 签名替代 Developer ID。
4. 扩展 `build/macos/validate-dmg.js`：验证单一 arm64 executable、DMG `/Applications` link、图标/背景配置、禁止 Windows runtimes/build/tests/.github、私密文件、绝对用户路径；生产额外验证 `codesign --verify --deep --strict`、`stapler validate`、`spctl --assess`。检查后总能 detach 自己创建的 mountpoint 并只删除自己创建的 temp 目录。

#### 5.2 凭据与候选 CI

1. 仓库管理员在 GitHub `release-signing` Environment 中配置并审批以下 secrets：
   - `MACOS_CERTIFICATE_P12`：base64 Developer ID Application p12；
   - `MACOS_CERTIFICATE_PASSWORD`；
   - `APPLE_API_KEY_P8`：base64 App Store Connect API key；
   - `APPLE_API_KEY_ID`、`APPLE_API_ISSUER`。
   不向 fork PR、`pull_request_target`、普通 CI 或日志暴露它们。
2. 保持 `native-package-validation.yml` 仅 `workflow_dispatch`，在相同 ref/SHA 的 `windows-2025` 和 `macos-15` 运行；macOS job 必须先 `uname -m == arm64`，导入临时 keychain，构建、smoke、validate，再以 `always()` 清理 keychain、p12、p8。
3. Windows job 继续运行未经本计划改写的 `npm run build:win`，验证 PE machine `0x8664`，上传仅 installer。若项目决定 Windows 也要签名，另行在 Windows signing 环境完成 `rcedit → main EXE 签名 → NSIS → installer 签名 → Authenticode`；不能借 macOS 迁移偷偷改变 Windows 签名路径。
4. 在候选 workflow 结束后产出 `SHA256SUMS`、版本、commit SHA、Node/Electron/electron-builder、notary/Gatekeeper 状态和 artifact 名称的 manifest。manifest 不含机密、用户路径或 token。

#### 5.3 Draft Release（不得重建）

1. 新建单独的受保护 `release-publisher.yml`，仅 workflow dispatch，由发布负责人输入**已完成 native-package-validation 的 run ID**和预期候选 SHA；它不得构建二进制。
2. Publisher 下载该 run 的两个 artifacts 和 manifest，验证：run 的 `headSha` 等于输入 SHA、Windows installer/DMG 都存在、所有 SHA256 与 manifest 匹配、DMG 是 signed/notarized 验证过的 artifact、版本一致、无正式 Tag 已占用。
3. 验证成功后，以该 SHA 创建新的不可变 annotated 项目 Tag（名称不与上游 Tag 混淆），创建 Draft Release，上传**已验证的原始 artifacts 和 manifest**。如果任一验证失败，停止，不打 Tag、不发布；修复必须创建新候选 SHA 并重走 native gates。
4. Draft Release 只在 Windows QA、macOS QA、独立 release-security 审查均签署同一 SHA/artifact 后发布。绝不因发布步骤重新构建或替换 artifact。

**完成标准**：签名 credentials 只在 protected environment 的临时路径存在；正式 DMG 经 notarize/staple/Gatekeeper；同 SHA 原生两端产物有 checksums/manifest；发布者零 rebuild，Tag/Draft Release 与 artifact SHA 一致。

### 阶段 6：双平台 QA、安全审查、合并与交付

**输入**：阶段 5 的同 SHA artifacts、CI 记录、manifest。
**输出**：独立签署的 QA/安全结果、完整文档、已推送候选分支；只有所有门禁通过才形成可合并/可发布候选。

1. **Windows QA（独立于 Windows 实现者）**：Windows x64 clean machine 安装 NSIS EXE；检查安装路径 safeguard、卸载安全、快捷方式、启动/更新页、播放、歌词、登录、本地库、快捷键/媒体键、音频设备、多显示器、睡眠恢复、系统托盘、Wallpaper Engine、完整桌面模式和崩溃恢复。记录 OS/build、artifact checksum、通过/失败、截图/日志的无敏感位置。
2. **macOS QA（独立于 macOS 实现者）**：Apple Silicon clean user/VM 挂载 DMG、拖入 `/Applications`、首次 Gatekeeper 启动；检查签名/公证、Dock、菜单、状态栏项/close behavior、窗口/红绿灯/全屏 Space、多显示器、歌词 panel、IME、VoiceOver、快捷键/媒体键、播放/音频设备、Provider 登录、local library、sleep/wake、完整 DMG 更新路径和卸载。禁止使用真实日常 profile。
3. **release-security 审查（独立于实现者）**：复核 commit/artifact/checksum 身份，扫描 staged/release artifacts 是否含 `.cookie`、`.qq-cookie`、`.kugou-cookie`、`.qishui-*`、`.spotify-*`、`.env*`、token、日志、绝对用户路径、local media、旧 dist；复核 IPC/preload、安全 headers/外部导航、workflow pinning/secrets、entitlements 和依赖 audit。
4. **冲突判定**：将发现区分为 Windows regression、macOS defect、可接受原生差异、Windows-only unsupported、证据不足。只有前两类阻塞；不可实现 Windows-only 功能需要 capability/UI/IPC proof，不是“缺失”。
5. **合并**：所有质量门禁通过且用户/维护者批准后，审查从 `main` 到候选 SHA 的完整 diff，保持 Windows build/test unchanged，合并完整提交历史。合并后再次运行 dual-platform CI；正式发布仍按阶段 5 publisher 规则从已验证产物完成。

## 4. 数据、状态和模块依赖

### 4.1 Platform snapshot

`platform.snapshot()` 是唯一 renderer 平台发现数据源：

```js
{
  ok: true,
  platform: 'darwin' | 'win32',
  platformId: 'macos' | 'windows',
  capabilities: {
    fullDesktopMode: boolean,
    wallpaperEngine: boolean,
    tray: boolean
  }
}
```

`public/js/modules/00-state/00-platform-capabilities.js` 缓存该 snapshot，设置 `html[data-platform]`，并用 `data-platform-capability` 隐藏/显示入口。新增或改名 capability 时，须同步更新 `capabilities.js`、两个 adapter、snapshot contract test、preload/renderer test 和 UI 文案。

### 4.2 Close/tray 状态流转

```text
persisted preference / renderer request
  -> trusted validation + normalizeCloseBehavior
  -> platform.supports('tray')?
       yes: ensure platform.tray.createOrUpdate -> persist 'tray' -> hide main window
       no / create failure: persist 'exit' -> return stable error -> app.quit on close

status item "Show" or Dock activate -> show + focus exactly one main window
explicit Quit / before-quit -> mark appQuitting -> destroy tray -> platform cleanup -> quit
```

- 所有状态写入使用现有受控 local-data preference 路径，不能在应用 bundle、工作目录或 renderer local arbitrary path 写文件。
- preference 中的未知、超长、非字符串值一律归一为 `exit`，不保留扩展兼容层。
- `tray` lifecycle 只保有主进程对象；renderer 只能通过既有 close behavior API 获取结果。

### 4.3 构建与发布依赖链

```text
source + package-lock
  -> shared/platform/build CI (no secrets)
  -> protected native candidate workflow (same SHA)
       -> Windows x64 installer + PE validation
       -> macOS arm64 signed/notarized DMG + packaged smoke + Gatekeeper validation
  -> QA + security review + manifest checksum approval
  -> publisher downloads existing artifacts, verifies identity
  -> annotated Tag + Draft Release -> publish
```

任何上游依赖更新、`package.json`/lockfile 变更、native build config 变更都重新从 CI 开始；任何 artifact 变化都重新走 native build、QA 和安全审核。

## 5. 完整测试与验收矩阵

| 层级 | 自动化内容 | 运行位置 | 通过条件 |
|---|---|---|---|
| Shared unit | 当前 shared 安全/路径测试 + 10 个 node:test + 12 个 legacy shared 测试 | Windows CI、macOS CI | 全部通过；live/provider 不默认运行。 |
| Contract | 平台契约、snapshot、unsupported、IPC authorization/payload、close/tray、local library/lyrics/hotkeys | Windows CI、macOS CI | Windows true capability 和 macOS 原生/unsupported 结果均准确。 |
| Windows platform | HWND/WorkerW/DWM/WE、desktop icon layer、Windows system memory、NSIS | Windows only | 原测试不改且通过；native EXE 安装 smoke 通过。 |
| macOS platform | app menu/Dock/status item、shortcuts、window/full screen、lyrics panel、memory snapshot、TCC source boundary | macOS arm64 | 自动 tests 通过；真机项目有记录。 |
| Electron smoke | source main entry、packaged app、renderer crash recovery、close/status item restore | Apple Silicon macOS | 每次使用独立 owned `userData`，启动/退出/恢复无泄露。 |
| Build/artifact | config fail-closed、ICNS/DMG layout、content hygiene、arm64, codesign, notarize, staple, Gatekeeper | macOS arm64；Windows PE 验证 | 所有验证命令退出 0，manifest 完整。 |
| E2E manual | 安装、Provider、音频、media keys、IMEs、multi-display、sleep/wake、update | 真实 Windows x64/Apple Silicon | 独立 QA checklist 全项通过或有批准的限制记录。 |
| Security | audit、secret/path scan、workflow review、entitlements、artifact identity | 独立审查环境 | 无阻塞项，签名/秘密边界可证明。 |

### 必测边界条件

- 不可信 webContents、iframe/subframe、非 loopback URL、销毁窗口、handler 已 cleanup 后调用。
- 空值、错误类型、超长 string、巨大/循环 payload、未知枚举、越界坐标、跨用户数据目录 path、非 HTTPS update URL。
- tray 图片/菜单 API 失败、状态栏重复创建、连续 close/restore/quit、window-all-closed/Dock activate 竞态。
- macOS 无签名 credentials、错误 p12 密码、缺少任一 App Store API key 值、公证失败、staple/Gatekeeper 失败、错误 CPU 架构、DMG 内多 app/无 Applications link。
- 拒绝 camera/microphone 权限、没有设备、音频切换失败、renderer crash、网络/Provider 失败、离线更新页、cookie 清理中断。
- Unicode/emoji/CJK metadata、大小写路径差异、`/var` 与 `/private/var`、CRLF/CRCRLF workflow fixture。

## 6. 风险、阻塞与处置

| 风险/阻塞 | 影响 | 处置/停止条件 |
|---|---|---|
| 缺 Developer ID/Notary 账号或 GitHub Environment approval | 无法形成可发布 macOS DMG | 代码/unsigned 本地验证可继续；正式 native candidate、Tag/Release 必须停止并报告所缺权限。 |
| 无 Windows 真机/runner 安装 QA | 无法证明 EXE 未回归 | 可运行 Windows CI contract/build；正式合并/发布前必须由独立 Windows QA 补齐。 |
| macOS status item 与既有 Windows tray 耦合 | 可能伤及 Windows | 先以契约 service 注入，Windows adapter 用现有行为，Windows 专属测试/手工回归作为门禁。 |
| macOS 全屏歌词层级限制 | 无法覆盖第三方全屏 app | 不使用私有 API 或屏保级别 hack；保持 `floating`，记录实际结果并由产品接受。 |
| Provider 反爬/登录变化 | 自动化不稳定、隐私风险 | 无凭据自动测试只验证窗口/授权边界；人工 QA 使用合成或获准测试账号，绝不收集/提交凭据。 |
| 新依赖/lockfile 影响 Electron ABI/供应链 | 构建或安全回归 | 检查 lockfile diff、license、`npm audit`、Windows/macOS native builds；失败则回滚该依赖切片。 |
| Release workflow 默认分支限制 | workflow dispatch 不可发现/执行 | 不提前合并候选；由维护者在受控 PR/默认分支策略下安排 workflow 可见性，凭据前不发布。 |

## 7. 每个实现切片的交付流程

1. 从候选分支创建独立工作分支/worktree；声明唯一文件所有权。不得并发编辑 `desktop/main.js`、preload、platform contract、package/lockfile。
2. 先新增失败测试，确认它确实捕捉目标缺口，再实现最小切片。不得仅添加源码正则或 mock 证明。
3. 执行本切片单测、`npm run test:shared`、`npm run test:platform`、`npm run test:build`；影响 Electron/packaging 时再运行对应 source/package smoke 与 native build。
4. 检查 `git diff --check`、完整 diff、`git status`；扫描敏感文件和生成内容。只 stage 本任务文件，保留用户已有改动。
5. 用简洁 commit message 提交并 push 当前候选分支；更新本计划的阶段状态和 `docs/CROSS_PLATFORM_BASELINE.md` 真实验证结果。
6. 阶段完成后由未实现该部分的 reviewer 审核平台契约、Windows 回归、macOS 原生行为或 release security；发现 blocker 创建新候选 SHA，不能改写已审 artifact。

## 8. 最终验收清单

只有以下所有项目为真，才可宣布“全部实现”并进入合并/正式发布：

- [ ] 所有可迁移共享功能在 macOS 可用，Windows-only 功能具有正确 capability/UI/unsupported 语义。
- [ ] macOS 原生窗口、菜单、Dock、状态栏菜单、close behavior、桌面歌词、全屏/Space 行为已自动化和真机验证。
- [ ] 所有原始 shared 测试已纳入双平台默认 CI；Windows-native 测试保持 Windows-only 且未被削弱。
- [ ] 所有新增/修改 IPC 与 preload API 有 trusted sender、payload、错误、cleanup 和 renderer 消费测试。
- [ ] `npm test`、macOS source smoke、packaged smoke、unsigned local DMG validation、双平台 CI 全部通过，并记录版本/环境/结果。
- [ ] Windows x64 EXE 和 macOS arm64 DMG 从同一 SHA 的 clean native runner 构建；PE/arm64、安装与 artifact manifest 均验证。
- [ ] macOS DMG 使用有效 `.icns`、DMG 引导、Developer ID、Hardened Runtime、最小 entitlements、公证、staple 和 Gatekeeper 验证。
- [ ] Windows QA、macOS Apple Silicon QA、release-security 审查独立通过同一 checksum 的 artifacts。
- [ ] 无 cookie/token/private media/日志/绝对用户路径/旧 dist 进入 Git、CI artifact 或 Release。
- [ ] 仅在前述所有项目通过后，publisher 从既有 artifacts 创建 annotated Tag 和 Draft Release；无 rebuild、无替换 artifact。

## 9. 实施时禁止事项

- 不把 Windows 分支、Windows 测试、NSIS/rcedit 或桌面运行时“为了跨平台”改坏；macOS 可以与 Windows 不同。
- 不创建 Linux、Intel macOS、Universal binary、compat export、fallback import 或两条长期产品主线。
- 不为了 macOS 测试绿而跳过、删除或放宽 Windows assertion；差异必须在 shared fixture 或 macOS test/adapter 正确表达。
- 不在 renderer 暴露 Node、fs、native handle、`ipcRenderer`，不关闭 context isolation 或放宽登录/外部导航/permission 安全边界。
- 不使用真实用户 profile、Cookie、音乐、token、签名证书或 API key 做测试；不将任何生成物、缓存、dist、keychain 文件提交。
- 不在候选审查前合并 `main`，不在 native/signing/QA gates 前创建或移动 Tag，也不在审批后重建 artifact。
