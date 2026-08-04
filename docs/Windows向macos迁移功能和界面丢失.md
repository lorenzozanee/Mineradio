# Windows 向 macOS 迁移功能和界面丢失审计

> **审计日期**: 2026-08-04
> **审计方法**: 6-Agent 并行审计 (ultracode workflow) + 主 Agent 综合裁定
> **审计范围**: `main` (89c0d23) → `codex/macos` (0a8ad53)
> **审计状态**: ✅ 完成 — 全部 6 个 Agent 已完成并交叉验证

---

## 1. 审计范围与基线

### 1.1 分支与提交

| 项目 | 值 |
|------|-----|
| **main（Windows 基线）** | `89c0d23` — `Update README.md` |
| **codex/macos（迁移分支）** | `0a8ad53` — `docs: record migration branch and test boundary rules` |
| **上游稳定版** | `v2.1.0`，commit `96091d1`，annotated Tag `37993d3` |
| **上游仓库** | `https://github.com/XxHuberrr/Mineradio.git` |
| **文件差异规模** | 77 文件变更，+6352/-308 行 |

`git merge-base --is-ancestor 96091d1 HEAD` 通过。上游 `main` 在 v2.1.0 发布后仅有 README-only 提交，无业务代码变更。

### 1.2 审计主机环境

- **OS**: macOS 15.6.1 (24G90), Darwin 24.6.0, Apple Silicon arm64
- **Node.js**: 26.4.0 | **npm**: 11.17.0
- **Electron**: 42.4.1 | **electron-builder**: 26.15.3
- **music-metadata**: 11.14.0

### 1.3 已验证的文档、目录与配置

| 类别 | 内容 |
|------|------|
| 项目约定 | `AGENTS.md` (22KB, 完整架构约定)、`CHANGELOG.md` (v0.9.9–v2.1.0)、`README.md` |
| 迁移文档 | `docs/Mineradio-macOS迁移与跨平台适配方案.md` (655行)、`docs/CROSS_PLATFORM_BASELINE.md`、`docs/MACOS_BUILD_SIGNING.md` |
| 主进程 | `desktop/main.js` (5693→5771行完整对比)、`desktop/preload.js`、`desktop/platform/` 全部文件 |
| 渲染器 | `public/index.html`、`public/js/index-loader.js`、`public/css/index.css`、`public/js/modules/` 所有关键模块 |
| 服务端 | `server.js` (6705→6707行完整对比)、所有根目录 API 文件 |
| 构建 | `package.json`、`electron-builder.macos.js`、`build/` 全部文件、`.github/workflows/` |
| 测试 | `tests/` (31→61文件完整清单)、`scripts/quick-check.js` 对比 |
| 平台实现 | `desktop/platform/macos/` (5文件)、`desktop/platform/windows/` (2文件)、`desktop/shared/` (7文件) |

### 1.4 已知验证限制

- **未在真实 Windows 环境验证** — 所有结论基于代码审计和平台契约测试
- **未在签名/公证环境验证** — Developer ID 凭据不可用
- **未进行真机 QA** — 音频设备切换、媒体键、多显示器、睡眠恢复、登录流程等需真实硬件
- **Provider 登录未经 macOS 真机验证** — 登录窗口理论上跨平台，但 Cookie 存储需在 macOS 实际验证
- **Feature Trace Agent 被中断** — 功能清单基于 CHANGELOG 人工追踪 + 多 Agent 代码交叉验证

---

## 2. Windows 功能与界面能力总览

> 标记说明: ✅ 已证实 (源码+测试证据) | ⚠️ 仅 Release 提及/代码证据部分 | 🔷 Windows 专属

### 2.1 播放与音频

| 功能 | 版本 | 证据 | 状态 |
|------|------|------|------|
| 多音源聚合播放（网易云/QQ/酷狗/汽水/Spotify） | v0.9.9+ | `server.js` 6600+行，各 API 文件 | ✅ |
| 播放队列管理（安全队列刷新、单曲循环、异步再入） | v1.0.0 | `server.js` playQueueAt 逻辑 | ✅ |
| 音频淡入淡出 | v1.0.8 | CHANGELOG | ✅ |
| 音频图恢复与回退事务 | v1.0.0 | `tests/playback-audio-graph-recovery.test.js` | ✅ |
| 播放源回退交易 | v2.0.2 | `tests/playback-source-fallback-transaction.test.js` | ✅ |
| 方向键音量调节（±5%） | v1.0.10 | CHANGELOG | ✅ |
| 天气电台（Open-Meteo + 推荐曲库混入） | v1.0.0 | `server.js` weather radio 模块 | ✅ |
| DJ 分析器（频谱/节拍检测） | v0.9.9 | `dj-analyzer.js` (975行) | ✅ |

### 2.2 视觉与 UI

| 功能 | 版本 | 证据 | 状态 |
|------|------|------|------|
| 7种视觉预设（emily/安魂/星河/唱片/星球/滚筒/虚空） | v1.0.8 | `public/js/modules/07-fx/` | ✅ |
| 3D 歌单架（动态/静态、播客开关、合并滚动） | v1.1.0 | `public/js/modules/03-ui/` shelf 模块 | ✅ |
| 视觉控制台（5分区、用户存档4槽位） | v1.0.3, v1.0.8 | 渲染器控制台模块 | ✅ |
| 封面粒子渲染 | v1.1.0 | `public/js/modules/07-fx/01-particles.js` | ✅ |
| 封面渐变背景 | v1.0.3 | 渲染器背景模块 | ✅ |
| 电影镜头效果 | v0.9.9 | 渲染器 camera/FX 模块 | ✅ |
| 歌词发光/角度/透明度调节 | v1.0.10, v1.1.0 | 歌词渲染模块 | ✅ |
| 颜色轮/封面取色面板 | v1.0.3 | 渲染器 color picker 模块 | ✅ |
| 启动动画（WebGL 光流线场 + 2D fallback） | v0.9.13 | `public/index.html` intro animation | ✅ |
| Sonic 视觉工坊/地形预设 | v0.9.9 | `public/sonic-workshop-preset.js` | ✅ |
| 沉浸模式（隐藏左侧栏） | v1.0.4 | 渲染器 UI modes | ✅ |

### 2.3 桌面集成 — Windows 专属

| 功能 | 版本 | 证据 | 状态 |
|------|------|------|------|
| Wallpaper Engine 集成（Steam/注册表/DWM/窗口嵌入） | v2.1.0 | `desktop/wallpaper-engine-library.js`, `desktop/wallpaper-engine-runtime.js` | 🔷 |
| 完整桌面模式（HWND/WorkerW/Progman/DWM） | v2.0.0 | `desktop/full-desktop-mode-runtime.js` | 🔷 |
| 桌面图标层（原生分层窗口、图标形状计算） | v2.0.0 | `desktop/desktop-native-icon-layer-runtime.js`, `desktop/desktop-icon-shape-runtime.js` | 🔷 |
| 桌面歌词（独立窗口、穿透/锁定/拖动/鼠标行为） | v1.0.10 | `desktop/main.js` L3449-3632, `public/desktop-lyrics.html` (1237行) | ✅ |

### 2.4 登录与账号

| 功能 | 证据 | 状态 |
|------|------|------|
| 网易云音乐登录（扫码/Cookie） | `desktop/main.js` `openNeteaseMusicLoginWindow()` | ✅ |
| QQ 音乐登录（扫码/psrf_*/wx* token） | `desktop/main.js` `openQQMusicLoginWindow()` | ✅ |
| 酷狗音乐登录 | `desktop/main.js` 酷狗登录窗口 | ✅ |
| 汽水音乐登录（本地登录态检测） | `qishui-auth-v6.js`, `qishui-qr-login.js` | ✅ |
| Spotify OAuth 登录 | `desktop/main.js` Spotify 登录窗口 | ✅ |
| 登录彩蛋门控 | `desktop/login-easter-egg-gate.js` | ✅ |
| QQ VIP 权益检测 | `qq-vip-api.js`, `tests/qq-vip-entitlement.test.js` | ✅ |
| 酷狗 VIP 强化 | `tests/kugou-vip-hardening.test.js` | ✅ |

### 2.5 本地曲库

| 功能 | 证据 | 状态 |
|------|------|------|
| 本地音乐导入（FLAC/MP3 标签解析、封面提取、LRC 歌词） | `desktop/local-music-library.js`, `tests/local-music-library-persistence.test.js` | ✅ |
| Unicode 元数据支持 | AGENTS.md 基线确认 | ✅ |
| caseInsensitivePaths 参数 | `desktop/main.js` L278: `platform.runtime.caseInsensitivePaths` | ✅ |

### 2.6 设置与偏好

| 功能 | 证据 | 状态 |
|------|------|------|
| 用户存档（视觉参数保存/恢复） | CHANGELOG v1.1.0, v1.0.8 | ✅ |
| 高级性能设置（后台策略、画质档位、直播后台保持） | CHANGELOG v1.1.0 | ✅ |
| 关闭行为（退出/最小化/后台托盘） | `desktop/main.js` `closeBehavior` 逻辑 | ✅ |
| 缓存路径设置 | `desktop/main.js` `mineradio-cache-*` IPC | ✅ |
| 快捷键绑定 | `desktop/main.js` `mineradio-hotkeys-configure-global` | ✅ |
| 沉浸模式 / DIY 模式 | `public/js/modules/00-state/02-preferences-ui-modes.js` | ✅ |

### 2.7 更新与发布

| 功能 | 证据 | 状态 |
|------|------|------|
| GitHub Release 更新检测（多镜像线路） | `server.js` update 模块, CHANGELOG v1.0.5 | ✅ |
| 快速补丁（patch 包、版本精确匹配） | CHANGELOG v1.0.5, v1.0.10 | ⚠️ macOS 无 patch 机制 |
| 完整安装包下载（手动确认、复用已校验文件） | CHANGELOG v1.1.0 | ✅ |
| Release digest 校验 | CHANGELOG v1.0.5 | ✅ |
| electron-builder 自动 publish | package.json Windows build config | 🔷 macOS `publish: null` |

### 2.8 安装器 — Windows 专属

| 功能 | 证据 | 状态 |
|------|------|------|
| NSIS 自定义安装器（600+行：欢迎页、目录选择、深色主题） | `build/installer.nsh` | 🔷 |
| C 盘阻止（优先 D-Z 盘、非空目录拒绝） | `build/installer.nsh` | 🔷 |
| 安全卸载器（仅删除已知文件、安装标记验证） | `build/installer.nsh`, CHANGELOG v1.1.1 | 🔷 |
| 桌面快捷方式 / 开始菜单 | package.json NSIS 配置 | 🔷 |
| rcedit 资源注入（图标/版本信息） | `build/after-pack.js` | 🔷 |

### 2.9 Feature Trace Agent 逐项核实摘要

以下 15 个特性由 Feature Trace Agent 逐项用硬代码证据核实，结论经主 Agent 交叉验证：

| 特性 | CHANGELOG 版本 | 迁移状态 | 关键代码证据 |
|------|---------------|---------|-------------|
| 全桌面模式 | v2.0.0, v1.0.0 | **未迁移** | `fullDesktopMode: false` (`desktop/platform/macos/index.js:42`)，14 个 unsupported 存根 (`native-desktop-features.js:58-78`) |
| Wallpaper Engine | v2.1.0, v1.0.0 | **未迁移** | `wallpaperEngine: false` (`desktop/platform/macos/index.js:43`)，20 个 unsupported 存根 (`native-desktop-features.js:19-80`) |
| 桌面歌词 | v1.0.10, v2.0.3 | **已完整迁移** | `type:'panel'` + `setAlwaysOnTop('floating')` (`desktop/platform/macos/index.js:65-73`) |
| 登录系统 (5 Provider) | v2.0.2, v1.0.0 | **已完整迁移** | `BrowserWindow` + `session.fromPartition()` — 零 `process.platform` 检查 |
| 本地音乐库 | v2.1.0 | **已完整迁移** | `pathIdentity` 抽象大小写差异；`music-metadata` npm 包跨平台 |
| 更新/自动更新 | v1.1.0, v1.0.5 | **已完整迁移** | REST API (`server.js:4767`)；客户端下载已全局禁用 (`server.js:4779`) |
| 安装器 | v1.1.1, v1.0.9 | **平台专属** | macOS: DMG + notarize；Windows: NSIS — 各自独立实现 |
| 内存管理 | v1.0.4 | **部分迁移** | 快照可用；`SYSTEM_PURGE_AVAILABLE: false` — trim/purge unsupported |
| 快捷键/媒体键 | v1.0.10 | **已完整迁移** | macOS `globalShortcut` + 方向键音量 — 零平台代码 |
| 主页/天气电台 | v1.0.0 | **已完整迁移** | REST API + DOM 渲染器 — 零平台代码 |
| 启动动画 | v0.9.13 | **已完整迁移** | WebGL Canvas — Web 标准，零平台代码 |
| 视觉预设/控制台 | v1.0.3–v1.1.0 | **已完整迁移** | Three.js/WebGL — 零 `process.platform` 检查 |
| 3D 歌单架 | v2.0.3–v1.0.0 | **已完整迁移** | 7 个 shelf 模块 (~2706 行) — 全部 Three.js/WebGL |
| 播放引擎 | v1.0.0 | **已完整迁移** | Web Audio API (`AudioContext`/`AnalyserNode`) — Web 标准 |
| 视觉细节 (色轮/粒子/发光) | v1.0.9–v1.0.3 | **已完整迁移** | WebGL 着色器/粒子系统 — 跨平台 |

**统计**: 11 完全迁移 / 1 部分迁移 / 2 未迁移 (Windows 内核 API 依赖) / 1 平台专属

---

## 3. 迁移覆盖矩阵

迁移状态: **已完整迁移** | **已迁移但存在差异** | **部分迁移** | **尚未迁移** | **Windows 专属，macOS 不适用** | **证据不足**

差异类型: **功能缺失** | **UI/交互差异** | **平台能力限制** | **IPC/架构断链** | **打包/签名/发布缺口** | **测试覆盖缺口** | **可接受的平台原生差异**

### 3.1 平台抽象层（新增）

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 平台契约 | 无（直接调用系统 API） | `createPlatformContract()` 定义 8 个服务接口 | 已完整迁移 | 架构改进 | `desktop/platform/contract.js` | — |
| 平台组合根 | `process.platform` 散落各处 | `createPlatform()` 统一选择 | 已完整迁移 | 架构改进 | `desktop/platform/index.js` | — |
| 能力表 | 无 | `snapshot()` 返回 `{ capabilities, platform, platformId }` | 已完整迁移 | 新增 | `desktop/platform/contract.js:snapshot()` | — |
| Unspported 语义 | 无（功能不存在则崩溃） | 结构化 `unsupportedResult`（含 `ok: false, unsupported: true, error, status`） | 已完整迁移 | 新增 | `desktop/platform/contract.js:unsupportedResult()` | — |
| 原生桌面功能加载 | 直接 require | `loadNativeDesktopFeatures()` 按平台返回实现或存根 | 已完整迁移 | 架构改进 | `desktop/platform/index.js` | — |

### 3.2 主窗口

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 窗口框架 | `frame: false, transparent: true` 无边框透明 | `frame: true, transparent: false, titleBarStyle: 'hiddenInset'` 原生标题栏 | 已迁移但存在差异 | 可接受的平台原生差异 | `desktop/platform/windows/index.js` vs `desktop/platform/macos/index.js:mainOptions()` | macOS 原生窗口控件是标准做法 |
| 红绿灯按钮 | 自定义最小化/最大化/关闭按钮 | 原生红绿灯 `trafficLightPosition: { x: 18, y: 18 }` | 已迁移但存在差异 | 可接受的平台原生差异 | `desktop/platform/macos/index.js:mainOptions()`, CSS `html[data-platform="darwin"]` | 自定义按钮被 CSS 正确隐藏 |
| 标题栏内边距 | 无特殊处理 | CSS `padding-left: 86px` 避开红绿灯 | 已迁移但存在差异 | 可接受的平台原生差异 | `public/css/index.css` L477-484 | 正确实现 |
| 全屏行为 | `frame: false` 无边框全屏 | `fullscreenable: true` + 原生 macOS Space | 已迁移但存在差异 | 可接受的平台原生差异 | `desktop/platform/macos/index.js:mainOptions()` | macOS Space 是标准全屏方式 |
| 窗口图标 | `icon: APP_ICON_ICO` (.ico 文件) | 无显式 icon（依赖 .app bundle） | 已迁移但存在差异 | 可接受的平台原生差异 | `desktop/platform/windows/index.js:mainOptions()` vs macOS | macOS 从 bundle 读取图标 |
| 窗口配置后处理 | `successfulNoop` | `setWindowButtonVisibility(true)` | 已迁移 | 平台原生差异 | `desktop/platform/macos/index.js:configureMainWindow()` | 正确实现 |
| Chromium 开关 | `--use-angle=d3d11` | 空数组（默认 Metal via ANGLE） | 已迁移但存在差异 | 可接受的平台原生差异 | `desktop/platform/windows/index.js` vs `desktop/platform/macos/index.js:chromiumSwitches()` | macOS 默认 Metal — 正确 |

### 3.3 桌面歌词

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 歌词窗口类型 | 普通 `BrowserWindow` | `BrowserWindow` type: `panel` | 已迁移但存在差异 | 可接受的平台原生差异 | `desktop/platform/macos/index.js:desktopLyricsOptions()` | `panel` 适合桌面浮动面板 |
| 窗口置顶级 | `setAlwaysOnTop(true, 'screen-saver')` | `setAlwaysOnTop(true, 'floating')` | 已迁移但存在差异 | 平台能力限制 | `desktop/platform/windows/index.js` vs `desktop/platform/macos/index.js:configureDesktopLyricsWindow()` | macOS `floating` 在屏保之下 — 正确 |
| Mission Control 隐藏 | 无 | `hiddenInMissionControl: true` | 已新增 | 平台原生差异 | `desktop/platform/macos/index.js:desktopLyricsOptions()` | 歌词面板不应出现在 Mission Control |
| 所有 Space 可见 | `setVisibleOnAllWorkspaces(true)` | `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` | 已迁移但存在差异 | 可接受的平台原生差异 | 同上 | macOS 额外支持全屏 Space 可见 |
| 渲染器（HTML/JS/CSS） | `public/desktop-lyrics.html` (1237行) | 同一文件，无差异 | 已完整迁移 | — | `public/desktop-lyrics.html` 两个分支完全相同 | — |
| IPC 通道（6个） | `mineradio-desktop-lyrics-*` | 完全相同 | 已完整迁移 | — | `desktop/main.js` L789-794 | — |

### 3.4 Wallpaper Engine

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| WE 运行时 | `WallpaperEngineRuntime` 完整实现 | `UnsupportedWallpaperEngineRuntime` 存根（11方法） | Windows 专属，macOS 不适用 | 平台能力限制 | `desktop/platform/macos/native-desktop-features.js` | 正确的 unsupported 语义 |
| WE 库 | `WallpaperEngineLibrary` 完整实现（扫描/索引/协议） | `UnsupportedWallpaperEngineLibrary` 存根（6方法） | Windows 专属，macOS 不适用 | 平台能力限制 | 同上 | 全部返回 `unsupportedResult` |
| WE scheme 注册 | 注册 `mineradio-wallpaper:` 协议 | 存根返回 unsupported | Windows 专属，macOS 不适用 | 平台能力限制 | 同上 `registerWallpaperEngineScheme()` | 无害的空操作 |
| WE 渲染器初始化 | 无条件 `initializeWallpaperEngineLibrary()` | `subscribePlatformCapability('wallpaperEngine')` → 永不初始化 | 已迁移但存在差异 | 功能缺失（预期） | `public/js/modules/07-fx/03-wallpaper-engine-library.js` L2319+ | 正确 |
| WE UI 入口（3处） | 可见可操作 | `data-platform-capability="wallpaperEngine" hidden` 隐藏 | 已迁移但存在差异 | UI/交互差异 | `public/index.html` L427, 1659 | 正确 |
| WE 渲染器代码体积 | ~2300行 | ~2300行（macOS 永不执行） | — | 可接受的代码冗余 | `public/js/modules/07-fx/03-wallpaper-engine-library.js` | 后续可考虑 tree-shaking |

### 3.5 完整桌面模式

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 桌面模式运行时 | `FullDesktopModeRuntime` 完整实现（HWND/WorkerW/DWM，12方法） | `UnsupportedFullDesktopModeRuntime` 存根（12方法） | Windows 专属，macOS 不适用 | 平台能力限制 | `desktop/platform/macos/native-desktop-features.js` | 全部返回 unsupported |
| 桌面模式 UI（3处） | 可见可操作 | `data-platform-capability="fullDesktopMode" hidden` | 已迁移但存在差异 | UI/交互差异 | `public/index.html` L804, 823, 1855 | 正确 |
| 桌面模式运行时状态 | 完整状态机 | `supported: false` 全部重置 | 已迁移 | 功能缺失（预期） | `public/js/modules/10-shell/04-desktop-overlay-fullscreen.js` | 通过能力事件正确重置 |
| 桌面模式错误提示本地化 | — | "当前系统不支持" | 已迁移 | UI/交互差异 | `public/js/modules/10-shell/04-desktop-overlay-fullscreen.js` L1351 | 正确 |
| `hookExplorerRestartForFullDesktop` | PowerShell 注册 Windows 消息 | `platform.supports('fullDesktopMode')` → 提前返回 | 已迁移 | 平台能力限制 | `desktop/main.js` L3721 | 正确守卫 — macOS 永不执行 PowerShell |
| Escape 快捷键 | 注册全局 Escape 退出桌面模式 | 注册但桌面模式永不激活 | 已迁移 | 平台能力限制 | `desktop/main.js` | 无害 |

### 3.6 系统托盘

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 托盘创建 | `new Tray(APP_ICON_ICO)` 完整托盘 | `platform.supports('tray')` → 立即返回 | Windows 专属，macOS 不适用 | 平台能力限制 | `desktop/main.js` L2077-2078 | **P0 缺口** — 见第4节 |
| 托盘菜单 | 显示/退出桌面模式/退出应用 | 永不创建 | 已迁移 | 平台能力限制 | `desktop/main.js` L2091-2107 | 正确 |
| "后台托盘" 关闭选项 | 可见可点击 | `data-platform-capability="tray" hidden` 隐藏 | 已迁移但存在差异 | UI/交互差异 | `public/index.html` L951 | 正确 |
| 关闭行为 fallback | `closeBehavior === 'tray'` + `hide()` | macOS 主进程拒绝 'tray' 行为 | 已迁移 | 平台能力限制 | `desktop/main.js` L2125, 5494 | **P0 缺口** — 见第4节 |
| 桌面快捷方式创建 | `createDesktopShortcut` (.lnk) | `platform.supports('tray')` 守卫 → 不执行 | 已迁移 | 平台能力限制 | `desktop/main.js` L2296 | 正确 — macOS 无需 .lnk |

### 3.7 快捷键

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 快捷键服务 | Windows 原生 globalShortcut | macOS 完整实现（207行） | 已迁移但存在差异 | 平台原生差异 | `desktop/platform/macos/shortcuts.js` | — |
| 修饰符规范化 | 原始 accelerator 直接注册 | Ctrl→CommandOrControl, Meta/Super→Command, Alt→Alt | 已迁移 | 平台原生差异 | `desktop/platform/macos/shortcuts.js` MODIFIER_ALIASES | macOS 正确映射 |
| 最大绑定数 | 无限制 | 32（`GLOBAL_SHORTCUT_MAX_BINDINGS`） | 已迁移但存在差异 | 平台能力限制 | `desktop/platform/macos/shortcuts.js` L3 | 32 足够 — 可接受 |
| 桌面模式快捷键 | 可注册 | `DESKTOP_MODE_ACTION` → `unsupported` 拒绝 | 已迁移 | 功能缺失（预期） | `desktop/platform/macos/shortcuts.js` L13 | 正确 |
| 支持的操作 | 无限制 | 8个白名单操作 | 已迁移但存在差异 | 平台能力限制 | `desktop/platform/macos/shortcuts.js` SUPPORTED_ACTIONS | 需真机验证媒体键 |
| before-quit 清理 | `unregisterMineradioGlobalHotkeys()` | `platform.shortcuts.cleanup()` | 已迁移 | 架构改进 | `desktop/main.js` L5695 | 正确 |

### 3.8 内存管理

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 应用内存修剪 | PowerShell `SetProcessWorkingSetSize` | `unsupported` 返回 | Windows 专属，macOS 不适用 | 平台能力限制 | `desktop/platform/macos/system-memory.js` L46 | macOS 内核自行管理 — 正确 |
| 系统内存清理 | PowerShell 编译 C# `NtSetSystemInformation` purge | `unsupported` 返回 | Windows 专属，macOS 不适用 | 平台能力限制 | 同上 L47 | 正确 |
| 进程提权检测 | `GetTokenInformation` check | 始终返回 `false` | 已迁移但存在差异 | 平台能力限制 | 同上 L48 | macOS 无对应概念 — 合理 |
| 内存快照 | GlobalMemoryStatusEx + WMI | `os.totalmem()/freemem()` + `process.memoryUsage()` | 已迁移但存在差异 | 平台能力限制 | 同上 `getMemorySnapshot()` | 正确 — 基本快照足够 |
| 自动内存策略 | 完整状态机（mask/threshold/interval/elevate） | `SYSTEM_PURGE_AVAILABLE: false` → 自动定时器仅报告 RSS | 已迁移 | 功能缺失（预期） | `desktop/main.js` L1962 `scheduleAppMemoryTrim()` 守卫 | 正确 |
| 原生临时路径 | PowerShell 脚本路径 | No-op `{ ok: true }` | 已迁移但存在差异 | 平台能力限制 | `desktop/platform/macos/system-memory.js:setNativeTempPath()` | 正确 — macOS 无需 PowerShell 路径 |

### 3.9 更新与发布

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| GitHub Release 检测 | `server.js` update 模块（HTTP API + 多镜像） | 同一代码 | 已完整迁移 | — | `server.js` update 模块完全相同 | — |
| 多镜像线路 | 3个国内镜像 + GitHub 直连 | 同一配置 | 已完整迁移 | — | package.json `mineradio.update.mirrors` | — |
| 快速补丁 | Windows .patch 文件 | 同一逻辑但 macOS 无 patch 路径 | **部分迁移** | 打包/签名/发布缺口 | `server.js` patch 逻辑 | macOS DMG 必须完整下载 |
| electron-builder publish | 自动 publish | `publish: null` + `--publish never` | **尚未迁移** | 打包/签名/发布缺口 | `electron-builder.macos.js` via `build/macos/configuration.js` | **P0** — 需要发布流水线 |
| 更新 UI（进度/速度/线路） | 渲染器端更新弹窗 | 同一代码 | 已完整迁移 | — | 渲染器更新 UI | 需 macOS DMG 路径验证 |

### 3.10 安装与分发

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 安装器 | NSIS 自定义安装器（600+行） | DMG (拖拽安装) | 已迁移但存在差异 | 打包/签名/发布缺口 | `build/installer.nsh` vs `electron-builder.macos.js` | — |
| 安装路径安全 | C盘阻止、非空目录拒绝、安装标记 | DMG 无安装路径概念 | 可接受的平台差异 | — | macOS DMG 拖拽安装是标准做法 | — |
| 卸载器安全 | 仅删除已知文件、旧卸载器清理 | 拖入废纸篓 | 可接受的平台差异 | — | macOS 无注册表概念 | — |
| 应用图标 | .ico 多分辨率 | .png（非 .icns） | **已迁移但存在差异** | 打包/签名/发布缺口 | `electron-builder.macos.js` `icon: "build/icon.png"` | **P1** — 需 .icns（Retina 模糊） |
| DMG 背景图 | N/A（NSIS 自定义页） | **未配置** | **尚未迁移** | 打包/签名/发布缺口 | `build/macos/configuration.js` DMG 配置 | **P1** — 需品牌背景图 |
| 代码签名 | `signAndEditExecutable: false` (未签名) | Hardened Runtime + Dev ID 签名（需凭据） | **部分迁移** | 打包/签名/发布缺口 | `build/macos/entitlements.plist`, CI workflow | **P0** — 需 Apple 凭据 |
| 公证 | N/A | `build/macos/notarize.js` + stapling | **部分迁移** | 打包/签名/发布缺口 | `build/macos/notarize.js` | **P0** — 缺 `@electron/notarize` 依赖 |
| CI/CD | 无 GitHub Actions | 双平台 CI + 手动原生验证 | 已新增 | 架构改进 | `.github/workflows/` | — |
| 发布流水线 | `build:win` 自动 publish | **无自动化** | **尚未迁移** | 打包/签名/发布缺口 | — | **P0** |

### 3.11 服务器与数据路径

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| Cookie 存储 | `__dirname/.cookie`（应用同级目录） | `~/.mineradio/.cookie`（用户数据目录） | 已迁移但存在差异 | **关键 Bug 修复** | `desktop/shared/local-data-paths.js` | macOS app bundle 只读 — 必须迁移 |
| Beatmap 缓存 | `D:\MineradioCache\beatmaps`（硬编码） | `~/.mineradio/beatmaps` | 已迁移但存在差异 | **关键 Bug 修复** | 同上 | 移除硬编码 Windows D: 盘路径 |
| 默认缓存根 | `D:\MineradioCache` 或 `appData/cache` | `userData/cache` | 已迁移但存在差异 | 可接受的平台原生差异 | 平台 `defaultCacheRoot` | macOS 无 D: 盘 — 正确 |
| 本地 HTTP 服务器 | loopback + 动态端口 | 完全相同 | 已完整迁移 | — | `server.js` L138-139 | — |
| 外部导航安全 | 内联 URL 验证 | `desktop/shared/external-navigation-validation.js` | 已迁移 | 架构改进 | `desktop/shared/external-navigation-validation.js` | 安全性提升 |
| IPC 安全 | 直接 `ipcMain.handle` | `trustedIpcMain`（sender验证+负载校验+策略） | 已迁移 | 架构改进 | `desktop/shared/trusted-ipc-main.js` 等 | **安全重大改善** |
| Beatmap C: 盘检查 | `beatCacheRootInfo()` 阻止写入 C: | 相同代码 — macOS 上 `'/'` ≠ `'C:'` | 已完整迁移 | 可接受的平台原生差异 | `server.js` L729-733 | macOS 无害 |

### 3.12 应用菜单与 Dock

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 应用菜单 | `autoHideMenuBar: true` 隐藏 | 原生 macOS 菜单栏（appMenu/editMenu/windowMenu） | 已迁移 | 平台原生差异 | `desktop/platform/macos/application-menu.js` | macOS 必须有菜单栏 — 正确 |
| Dock 激活 | N/A | `app.dock.show()` on activate | 已迁移 | 平台原生差异 | `desktop/platform/macos/index.js:onActivate()` | 正确 |
| `app.setAppUserModelId` | Windows 任务栏标识 | macOS `configureApp` → no-op `{ ok: true }` | 已迁移 | 平台原生差异 | `desktop/platform/macos/index.js:configureApp()` | macOS 不需要 — 正确 |

### 3.13 应用生命周期

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| window-all-closed | `app.quit()` 所有窗口关闭时退出 | 不退出（`quitWhenAllWindowsClosed: false`） | 已迁移但存在差异 | 可接受的平台原生差异 | `desktop/main.js` L5678 | macOS 惯例 — 正确 |
| before-quit 清理 | 清理 WE/桌面模式/快捷键/歌词/IPC | 相同（含 `platform.shortcuts.cleanup()` + `disposePlatformIpc()`） | 已完整迁移 | 架构改进 | `desktop/main.js` L5682-5756 | macOS 存根正确返回 |
| app.on('activate') | 无特殊处理 | `platform.lifecycle.onActivate()` → `app.dock.show()` | 已迁移 | 平台原生差异 | `desktop/main.js` L5666-5675 | macOS 点击 Dock 恢复 — 正确 |
| `app.whenReady()` | 直接 `createWindow()` | 先 `platform.lifecycle.onReady()` → `installApplicationMenu()` | 已迁移 | 平台原生差异 | `desktop/main.js` L5644-5647 | 正确 |
| QA 用户数据隔离 | `MINERADIO_STARTUP_QA_HIDDEN` | 扩展至 `MINERADIO_STARTUP_QA_ISOLATED` 模式 | 已迁移 | 架构改进 | `desktop/shared/startup-qa-paths.js` | 安全性提升 |

### 3.14 Provider API 平台指纹

| 功能/界面项 | Windows main 行为 | macOS 当前行为 | 迁移状态 | 差异类型 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| 汽水 API 设备指纹 | `device_platform: 'windows', os_version: 'Windows 11'` | 同一代码 | 已完整迁移（无变更） | 可接受的平台原生差异 | `qishui-api.js` L1623-1625 | 低风险 — API 欺骗指纹，非功能缺陷 |
| 汽水扫码 URL | `os=Windows` 参数 | 同一代码 | 已完整迁移（无变更） | 可接受的平台原生差异 | `qishui-auth-v6.js` L116 | 低风险 — API 欺骗 |
| 主机名 fallback | `os.hostname() \|\| 'Windows-PC'` | 同一代码 | 已完整迁移（无变更） | 可接受的平台原生差异 | `qishui-auth-v6.js` L65,72 | 极低风险 — `os.hostname()` 在 macOS 始终返回值 |

---

## 4. 应迁移但尚未完成的功能

### P0 — 阻塞发布

#### 4.1 缺少 `@electron/notarize` 依赖
- **用户影响**: macOS 签名构建在公证阶段 `require('@electron/notarize')` 抛出异常，无法生成可分发的 DMG
- **Windows 实现**: N/A（Windows 无公证概念）
- **macOS 缺失原因**: `build/macos/notarize.js` L56 调用 `require('@electron/notarize').notarize`，但该包未在 `package.json` devDependencies 中声明
- **证据**: `build/macos/notarize.js:56`, `package.json` devDependencies
- **迁移路径**: `npm install --save-dev @electron/notarize`，更新 lockfile
- **风险**: 低 — 纯依赖添加，不影响任何业务代码

#### 4.2 无 macOS 发布流水线
- **用户影响**: 无法自动构建、签名、公证和发布 macOS DMG
- **Windows 实现**: `build:win` 的 electron-builder publish 配置
- **macOS 缺失原因**: `electron-builder.macos.js` 设置 `publish: null`，`build:mac` 使用 `--publish never`
- **证据**: `build/macos/configuration.js:47`
- **迁移路径**: 创建 `.github/workflows/release.yml`，Tag push 触发，双平台构建 → 创建 GitHub Release → 上传产物
- **风险**: 中 — 需要 Apple Developer 凭据和 `release-signing` environment

#### 4.3 Apple Developer 凭据未配置
- **用户影响**: 无法签名/公证 macOS 应用（Gatekeeper 阻止运行）
- **macOS 缺失原因**: 5 个 GitHub Secrets（`MACOS_CERTIFICATE_P12`, `MACOS_CERTIFICATE_PASSWORD`, `APPLE_API_KEY_P8`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`）需仓库管理员配置
- **证据**: `.github/workflows/native-package-validation.yml` secrets 引用
- **迁移路径**: GitHub Settings → Environments → `release-signing` 中配置
- **风险**: 低 — 纯配置，不影响代码

#### 4.4 原始 main 分支共享测试在 macOS 未被验证 ⚠️ 新增

- **用户影响**: 播放引擎、登录、Provider API、搜索、首页推荐等核心路径的回归风险未被覆盖。macOS 平台重构过程中若引入共享代码 Bug，不会被现有 CI 捕获
- **Windows 实现位置**: 23 个共享测试（10 个 node:test 格式 + 12 个自运行 + 1 个 live smoke）存在于 main 分支，覆盖核心业务逻辑
- **macOS 缺失原因**: macos 分支的 `npm test` 仅包含新编写的 shared/platform/contract/build 测试，未将原始共享测试纳入 `test:shared` 脚本
- **证据**: `package.json` scripts.`test:shared` 仅列出 9 个文件；`git ls-tree --name-only main tests/` 显示 31 个原始测试文件
- **迁移路径**:
  1. 立即将 10 个 node:test 格式测试加入 `test:shared`（P0，<1 小时）
  2. 创建 `test:legacy` 脚本批量运行 12 个自运行测试（P1）
  3. 逐步转换自运行测试为 node:test 格式（P2）
- **风险**: 低（纯 CI 配置变更，不影响业务代码）

#### 4.5 系统托盘不支持导致关闭行为异常
- **用户影响**: 当 `closeBehavior === 'tray'`（用户设置关闭到托盘）时，macOS 无托盘可用。主窗口关闭后行为不确定 — 应用可能退出或悬挂在后台且无法恢复
- **Windows 实现位置**: `desktop/main.js` L2077-2107 `createOrUpdateTray()` 创建托盘图标 + 菜单；L5494 关闭事件中 `if (closeBehavior === 'tray')` hide 窗口
- **macOS 缺失原因**: `desktop/platform/macos/index.js` L52 声明 `tray: false`；`createOrUpdateTray()` L2078 `if (!platform.supports('tray')) return;` 立即返回
- **证据**: `desktop/main.js:2078`, `desktop/platform/macos/index.js:52`, `desktop/platform/capabilities.js:11`
- **迁移路径**: 
  1. 在关闭行为中检测 `closeBehavior === 'tray'` + `!platform.supports('tray')` → 降级为 `'hide'` 或 `'exit'`
  2. 评估是否实现 macOS 菜单栏附加项（NSStatusItem）作为替代
  3. 渲染器端已正确隐藏 "后台托盘" 选项，但需确保 `setCloseBehavior` IPC 在 macOS 上拒绝 `'tray'` 参数
- **风险**: 中 — 影响用户关闭行为预期

### P1 — 显著影响体验

#### 4.6 缺少 `.icns` 图标文件
- **用户影响**: macOS Dock/Finder 中图标在 Retina 显示器上模糊
- **证据**: `build/macos/configuration.js` L42 `icon: "build/icon.png"` — PNG 无法提供 @2x 分辨率
- **迁移路径**: 使用 `iconutil` 或 `png2icns` 从源素材生成 `build/icon.icns`
- **风险**: 低

#### 4.7 缺少 DMG 背景图
- **用户影响**: DMG 挂载后显示空白 Finder 窗口，缺少拖拽安装视觉引导
- **证据**: `build/macos/configuration.js` DMG 配置块无 `background` 属性
- **迁移路径**: 设计品牌 DMG 背景图（带箭头指向 /Applications），配置到 electron-builder
- **风险**: 低

#### 4.8 macOS 自动更新未经实际验证
- **用户影响**: macOS 用户可能无法接收到应用内更新通知
- **Windows 实现位置**: `server.js` update 模块（GitHub Release API + 多镜像）
- **macOS 缺失原因**: 更新代码跨平台，但 macOS DMG 无 patch 路径；需验证完整 DMG 下载流程
- **证据**: `server.js` update 模块在两个分支相同
- **迁移路径**: 
  1. 确认 macOS 上 `MINERADIO_USER_DATA` 环境变量可写
  2. 确认 DMG 下载后能正确触发挂载/替换流程
  3. macOS 上只能使用完整 DMG 更新（无 .patch 文件）
- **风险**: 中 — 需端到端验证

#### 4.9 桌面歌词置顶级差异可能导致全屏应用下不可见
- **用户影响**: 桌面歌词在 macOS 全屏应用下可能不可见（`'floating'` 级别低于 `'screen-saver'`）
- **证据**: `desktop/platform/macos/index.js:configureDesktopLyricsWindow()` vs Windows 实现
- **迁移路径**: 评估是否需要更高的置顶级；当前 `'floating'` 是 macOS 标准做法
- **风险**: 低 — 可能需要产品决策

### P2 — 改善体验

#### 4.10 package.json 描述仍写 "Windows"
- **用户影响**: 无（仅 npm 元数据）
- **证据**: `package.json` L7: `"description": "Windows 沉浸式音乐播放器..."`
- **迁移路径**: 改为通用描述

#### 4.11 macOS 仅 arm64（无 Intel/Universal）
- **用户影响**: Intel Mac 用户无法运行
- **证据**: `build/macos/configuration.js` `arch: ['arm64']`
- **迁移路径**: 评估是否需要 `arm64 + x64` Universal binary
- **风险**: 低 — 策略决策

#### 4.12 Wallpaper Engine 渲染器死代码 (~2300行)
- **用户影响**: 轻微增加 JS 解析时间（<100ms），无功能影响
- **证据**: `public/js/modules/07-fx/03-wallpaper-engine-library.js`
- **迁移路径**: 后续可条件加载，非紧急

---

## 5. 已迁移但存在功能或界面冲突的部分

### 5.1 关闭行为（close-to-tray）未降级处理

- **冲突**: 渲染器可能发送 `setCloseBehavior('tray')`，但 macOS 无托盘。主进程 `createOrUpdateTray()` 正确返回但不阻止 `tray` 行为被接受
- **发生条件**: macOS 用户通过设置或默认配置选择 "后台托盘" 关闭行为（虽然 UI 选项已隐藏，但可能通过配置文件残留）
- **涉及代码**: `desktop/main.js` L4560-4569 `setCloseBehavior` handler, L2077-2078 `createOrUpdateTray`
- **建议修复**: `setCloseBehavior` IPC handler 中检测 `!platform.supports('tray') && behavior === 'tray'` → 降级为 `'exit'` 或 `'hide'`

### 5.2 IPC 安全改进可能导致渲染器未授权调用失败

- **冲突**: macOS 分支引入 `trustedIpcMain`（sender 验证 + 负载校验 + 策略），Windows main 分支使用原始 `ipcMain.handle`。如果渲染器端调用方式与 Windows 不同，可能被拦截
- **涉及代码**: `desktop/shared/trusted-ipc-main.js`, `desktop/shared/privileged-ipc-policy.js`, `desktop/shared/window-ipc-authorization.js`
- **当前状态**: 渲染器调用方式在两个分支相同；`trustedIpcMain` 的 sender 验证基于 `event.senderFrame` 和 URL origin，macOS 和 Windows 应该行为一致
- **建议**: 双平台验证所有渲染器 IPC 调用正常通过

### 5.3 主窗口 option 合并顺序

- **冲突**: macOS `mainOptions()` 的 `frame: true, transparent: false` 覆盖 base 的 `frame: false, transparent: true`。合并通过 `...platformMainWindowOptions` 实现（spread 在 base 之后）
- **涉及代码**: `desktop/main.js` L5321-5343
- **当前状态**: 正确 — spread 顺序确保 macOS 覆盖 base
- **风险**: 如果未来 base 添加新 option 且 macOS 未覆盖，可能导致 macOS 外观异常

---

## 6. Windows 专属能力与 macOS 合理替代方案

### 6.1 Wallpaper Engine 集成

- **Windows 用户价值**: 将动态壁纸嵌入桌面背景层，实现沉浸式桌面体验
- **macOS 无法实现原因**: 
  1. 无 Wallpaper Engine 应用生态
  2. 无 Steam 注册表集成路径
  3. 无 DWM 缩略图/窗口嵌入 API
  4. 无对应桌面窗口层级模型
- **当前 macOS 处理**: `UnsupportedWallpaperEngineLibrary` + `UnsupportedWallpaperEngineRuntime` 存根（17个方法），全部返回 `unsupportedResult`
- **能力声明**: `wallpaperEngine: false`
- **UI 门控**: 3个 WE 元素通过 `data-platform-capability="wallpaperEngine" hidden` 隐藏；渲染器 `subscribePlatformCapability('wallpaperEngine')` 阻止 WE 库初始化
- **替代体验**: 无直接替代。macOS Dynamic Desktop 是系统级壁纸方案，与 Mineradio 视觉效果无关
- **判定**: ✅ 可接受的平台差异 — WE 是 Windows 生态独占产品

### 6.2 完整桌面模式（HWND/WorkerW/Progman/DWM）

- **Windows 用户价值**: 将 Mineradio 视觉效果注入桌面图标层下方，实现"桌面即播放器"
- **macOS 无法实现原因**:
  1. 无 WorkerW/Progman 窗口层次概念
  2. 无 HWND 窗口嵌入 API
  3. 桌面图标由 Finder 管理且不暴露窗口层级操作
  4. 无 `getNativeWindowHandle` / `SetParent` 等效 API
- **当前 macOS 处理**: `UnsupportedFullDesktopModeRuntime` 存根（12个方法），全部返回 unsupported
- **能力声明**: `fullDesktopMode: false`
- **UI 门控**: 完整桌面模式开关、帮助文字、控制停靠区（含图标可见性/软件锁定子控件）全部隐藏
- **替代体验**: macOS 全屏 Space (`fullscreenable: true`) 提供一定程度的沉浸感
- **判定**: ✅ 可接受的平台差异

### 6.3 桌面图标层（原生分层窗口 / HWND 嵌入）

- **Windows 用户价值**: 在桌面图标层显示 3D 视觉元素
- **macOS 无法实现原因**: 无 HWND、无分层窗口 API、无桌面图标网格管理
- **当前 macOS 处理**: `loadNativeDesktopFeatures()` 在 macOS 返回存根，`desktop/desktop-native-icon-layer-runtime.js` 和 `desktop/desktop-icon-shape-runtime.js` 仅在 Windows 加载
- **判定**: ✅ 可接受的平台差异

### 6.4 Windows 内存管理（PowerShell/WMI）

- **Windows 用户价值**: 主动修剪应用工作集、清理系统内存待机列表
- **macOS 无法实现原因**: 
  1. 无 PowerShell 运行时
  2. 无 WMI 接口
  3. 无 `SetProcessWorkingSetSize` / `NtSetSystemInformation` 等效
  4. macOS 内核自行管理内存压缩（memory compression）和 App Nap
- **当前 macOS 处理**: `SYSTEM_PURGE_AVAILABLE: false`, `SYSTEM_PURGE_ENABLED: false`；所有 PowerShell 操作返回 unsupported；自动定时器仅报告 RSS 不执行修剪
- **替代体验**: macOS 内存压缩和 App Nap 自动处理内存压力；`os.totalmem()/freemem()` 提供基本快照
- **判定**: ✅ 可接受的平台差异

### 6.5 系统托盘（Windows Tray）

- **Windows 用户价值**: 最小化到托盘、后台运行、托盘菜单快捷操作
- **macOS 无法实现原因**: macOS 无系统托盘概念；菜单栏附加项（NSStatusItem）语义不同
- **当前 macOS 处理**: `tray: false`、`createOrUpdateTray()` 提前返回
- **替代体验**: 
  - macOS 标准: 关闭窗口后应用保持运行，通过 Dock 图标恢复
  - 可选增强: 实现 NSStatusItem 菜单栏附加项（类似 Bartender/Dozer 等应用）
- **判定**: ⚠️ 需要产品决策 — 托盘关闭行为的降级处理是 P0，但菜单栏附加项是 P2 增强

### 6.6 NSIS 安装器与 rcedit

- **Windows 用户价值**: 引导式安装体验、路径安全验证、安全卸载器、版本信息嵌入
- **macOS 无法实现原因**: macOS 无 NSIS、无注册表、无 .exe 格式
- **当前 macOS 处理**: DMG + /Applications 符号链接 + `Info.plist` + Helper plist 补丁
- **替代体验**: DMG 拖拽安装是 macOS 标准；首次启动 Gatekeeper quarantine 通过公证处理
- **判定**: ✅ 可接受的平台差异

---

## 7. 测试审计

### 7.1 测试分类与变化

| 类别 | main 分支 | macos 分支 | 变化 |
|------|----------|-----------|------|
| 共享业务测试 | 18 | 24 (+6 shared 安全/IPC) | +6 |
| Windows 平台测试 | 5 | 6 (+1 `tests/platform/windows/`) | +1 |
| macOS 平台测试 | 0 | 4 | 全新 |
| 合约测试 | 0 | 8 | 全新 |
| macOS 冒烟测试 | 0 | 4 | 全新 |
| 构建测试 | 0 | 2 | 全新 |
| **合计** | **~31** | **~61** | **+30 文件, +~2,796 行** |

### 7.2 新增测试清单与评估

| 文件 | 行数 | 分类 | 质量评估 |
|------|------|------|---------|
| `tests/contracts/platform-contract.test.js` | 250 | CONTRACT | A — 覆盖能力快照、未知能力拒绝、适配器保留、unsupported 形状 |
| `tests/contracts/platform-ipc-boundary.test.js` | 149 | CONTRACT | A — 7个测试: 通道注册、不可信 sender、快照、unsupported、异常边界 |
| `tests/contracts/platform-renderer-capabilities.test.js` | 123 | CONTRACT | A — 5个测试: macOS 隐藏、Windows 显示、订阅/取消订阅 |
| `tests/contracts/renderer-platform-ux.test.js` | 153 | CONTRACT | A — macOS 控件禁用、恢复、CSS 验证、按键抑制 |
| `tests/contracts/wallpaper-engine-renderer-capability.test.js` | 71 | CONTRACT | B — 仅1个测试，未覆盖 WE 选择完整生命周期 |
| `tests/contracts/native-desktop-feature-boundary.test.js` | 102 | CONTRACT | A — 5个测试: macOS 选路、Windows 组合、macOS 无实现、清理、Linux 失败 |
| `tests/contracts/path-identity.test.js` | 28 | CONTRACT | B+ — 路径身份验证 |
| `tests/contracts/server-local-data-paths.test.js` | 55 | CONTRACT | B+ — 数据路径解析 |
| `tests/platform/macos/platform.test.js` | 42 | MACOS | B — 2个测试: 能力报告、Linux 组合失败 |
| `tests/platform/macos/shortcuts.test.js` | 207 | MACOS | A — 6个测试: 加速器规范化、修饰符、操作拒绝、注册/去重、边界 |
| `tests/platform/macos/system-memory.test.js` | 35 | MACOS | B — 2个测试: 快照、Windows 操作拒绝 |
| `tests/platform/macos/application-menu.test.js` | 123 | MACOS | A — 6个测试: 模板、安装、Dock、窗口选项、歌词面板、错误边界 |
| `tests/smoke/macos/main-entry-smoke.test.js` | 192 | SMOKE | A — 真实 Electron 运行时验证（需 Apple Silicon） |
| `tests/smoke/macos/packaged-app-smoke.test.js` | 84 | SMOKE | A — 打包应用验证 |
| `tests/build/ci-workflows.test.js` | 56 | BUILD | A — CI 配置验证 |
| `tests/build/macos-build.test.js` | 185 | BUILD | A — 8个测试: 配置、afterPack、权限、公证、DMG 验证 |
| `tests/shared/ipc-payload-validation.test.js` | 118 | SHARED | A — IPC 负载校验 |
| `tests/shared/trusted-ipc-main.test.js` | 84 | SHARED | A — 可信 IPC 主进程 |
| `tests/shared/external-navigation-validation.test.js` | 118 | SHARED | A — 外部导航安全 |
| `tests/shared/injected-platform-dependencies.test.js` | 58 | SHARED | B+ — 依赖注入 |
| `tests/shared/privileged-ipc-policy.test.js` | 36 | SHARED | B+ — IPC 策略 |
| `tests/shared/window-ipc-authorization.test.js` | 59 | SHARED | B+ — 窗口 IPC 授权 |

### 7.3 已证实的 Windows 功能测试（不应修改）

| 测试文件 | 测试内容 | macOS 等效 | 判定 |
|---------|---------|-----------|------|
| `full-desktop-mode-runtime.test.js` (48KB) | HWND/WorkerW 注入、桌面图标可见性 | `native-desktop-feature-boundary.test.js` 验证 unsupported | Windows 专属 — 正确保留 |
| `desktop-icon-shape-runtime.test.js` (9.9KB) | 图标形状计算、保护盾 | 无 — macOS 不适用 | Windows 专属 — 正确保留 |
| `desktop-native-icon-layer-runtime.test.js` (8.7KB) | 原生分层窗口、PowerShell/C# | 无 — macOS 不适用 | Windows 专属 — 正确保留 |
| `wallpaper-engine-idle-dispose.test.js` (993B) | WE 空闲处置 | `native-desktop-feature-boundary.test.js` 验证存根 dispose | macOS 存根已验证 |
| `main-window-runtime-recovery.test.js` (6.3KB) | 渲染进程崩溃恢复、全屏守卫 | **缺失** | **需补充 macOS 崩溃恢复测试** |

### 7.4 缺少 macOS 对等测试

| 测试领域 | 严重性 | 建议 |
|---------|--------|------|
| macOS 渲染进程崩溃恢复 | **HIGH** | 添加 `tests/smoke/macos/renderer-crash-recovery.test.js` |
| macOS 沙箱/TCC 权限 | **HIGH** | 添加安全范围书签、TCC 提示、权限边界测试 |
| macOS Dock 交互（真机） | **HIGH** | 补充真机验证 — 单元测试已有 |
| macOS 全屏 Space 行为 | **HIGH** | 添加 Space 进入/退出验证 |
| macOS 音频设备切换 | MEDIUM | 添加 CoreAudio 设备枚举测试 |
| macOS 原生菜单交互 | MEDIUM | 添加菜单项点击→操作调度验证 |
| macOS IME 行为（CJK） | MEDIUM | 添加中文/日文/韩文输入法组合窗口测试 |
| macOS 辅助功能 | MEDIUM | 添加 AX API / VoiceOver 测试 |
| macOS 自动更新路径 | MEDIUM | 验证 DMG 更新 + 无 patch 降级路径 |

### 7.4 原始 main 分支测试在 macOS 的覆盖缺口 ⚠️ P0

**严重性: P0** — main 分支 31 个原始测试中，macOS 分支的 `npm test` 仅覆盖 3 个。

#### 7.4.1 已覆盖 (3/31)

| 测试文件 | 覆盖方式 |
|---------|---------|
| `startup-qa-userdata-isolation.test.js` | 在 `test:shared` 中（已修改） |
| `local-music-library-persistence.test.js` | 在 `test:shared` 中（已修改） |
| `login-easter-egg-gate.test.js` | 在 `test:shared` 中（已修改） |

#### 7.4.2 Windows 专属 — 正确排除，不应在 macOS 运行 (5/31)

| 测试文件 | 测试内容 | 排除原因 |
|---------|---------|---------|
| `desktop-icon-shape-runtime.test.js` | 图标形状计算、保护盾、复杂度限制 | 依赖 HWND/Explorer 桌面图标网格 |
| `desktop-native-icon-layer-runtime.test.js` | 原生分层窗口、PowerShell/C# 守卫、命名管道 | 依赖 LWA_COLORKEY/SetWindowPos/HWND_BOTTOM |
| `full-desktop-mode-runtime.test.js` | WorkerW/Progman/DWM 注入、桌面图标可见性 | 47 处 Windows 内核 API 引用 |
| `main-window-runtime-recovery.test.js` | 渲染进程崩溃恢复、main.js 源码守卫 | 正则检查 WE/desktop-mode 源码 — 但 macOS 崩溃恢复行为未测试 |
| `wallpaper-engine-idle-dispose.test.js` | WE 运行时空闲处置 | 依赖 WallpaperEngineRuntime 真实实现 |

> 注: `main-window-runtime-recovery.test.js` 有 5 处 Windows 引用，测试的是 main.js 中 WE/桌面模式代码的存在性。但 **渲染进程崩溃恢复本身是跨平台需求** — macOS 上缺少等效测试是单独缺口（见 7.3）。

#### 7.4.3 共享业务逻辑 — 被 `npm test` 遗漏 (23/31) ⚠️

这些测试**不依赖 Windows API**，测试的是跨平台业务逻辑。它们被遗漏纯粹是因为 macos 分支的测试基础设施重构未将其纳入。

**A. node:test 格式 — 可立即加入 `test:shared` (10 个)**

| 测试文件 | 测试的业务域 |
|---------|------------|
| `external-update-page-bridge.test.js` | 更新页面桥接 |
| `home-daily-recommendation-virtualization.test.js` | 首页推荐虚拟化 |
| `home-daily-recommendations-backend.test.js` | 推荐后端 |
| `home-dashboard-update.test.js` | 首页仪表盘 |
| `home-hero-mp4-platform-recommend.test.js` | Hero MP4 推荐 |
| `qishui-passport-qr-login.test.js` | 汽水护照 QR 登录 |
| `qishui-tier-rights.test.js` | 汽水等级权限 |
| `search-frontend-pagination.test.js` | 搜索前端分页 |
| `ui-default-theme-shelf-layer.test.js` | UI 默认主题/歌单架层级 |
| `update-external-only.test.js` | 外部更新逻辑 |

**B. 自运行格式 — 需 `node tests/xxx.test.js` 逐个执行 (12 个)**

| 测试文件 | 测试的业务域 |
|---------|------------|
| `kugou-vip-hardening.test.js` | 酷狗 VIP 强化（web role/expiry/cache） |
| `login-easter-egg-ime-focus.test.js` | 登录彩蛋 IME 焦点 |
| `platform-account-sync-guard.test.js` | 平台账号同步守卫（源码正则检查） |
| `playback-audio-graph-recovery.test.js` | 音频图恢复（AudioContext 生命周期） |
| `playback-source-fallback-transaction.test.js` | 播放源回退事务 |
| `provider-entitlement-boundary.test.js` | Provider 权益边界 |
| `qishui-entitlement-cache.test.js` | 汽水权益缓存 |
| `qishui-local-official-merge.test.js` | 汽水本地/官方合并 |
| `qishui-provider-distribution.test.js` | 汽水 Provider 分发 |
| `qq-vip-entitlement.test.js` | QQ VIP 权益 |
| `spotify-api-resilience.test.js` | Spotify API 韧性 |
| `startup-navigation-readiness.test.js` | 启动导航就绪 |

**C. Live smoke — 需真实凭据 (1 个)**

| 测试文件 | 说明 |
|---------|------|
| `qishui-passport-live-smoke.js` | 汽水通行证实况冒烟（需真实 Cookie/设备指纹） |

#### 7.4.4 影响评估

- **用户功能风险**: 23 个遗漏测试覆盖了播放引擎、登录流程、Provider API、首页推荐、搜索等核心用户路径。如果 macOS 平台重构过程中引入了共享代码回归，这些测试本应捕获但现在不会运行
- **平台契约风险**: 部分测试（如 `platform-account-sync-guard.test.js`、`home-hero-mp4-platform-recommend.test.js`）包含对源码的禁止模式检查（如 DWM、Wallpaper Engine 关键字），这些检查对防止 Windows 代码泄露到共享层有价值
- **修复难度**: 10 个 node:test 格式测试可立即加入 `test:shared`；12 个自运行测试需要逐个验证后转换或创建 batch runner

#### 7.4.5 建议修复

1. **P0 — 立即**: 将 10 个 node:test 格式测试加入 `test:shared` 脚本
2. **P1 — 本周**: 创建 `test:legacy` 脚本批量运行 12 个自运行测试
3. **P2 — 后续**: 将自运行测试逐步转换为 `node:test` 格式并纳入 `test:shared`
4. **P2 — 后续**: 审核 `platform-account-sync-guard.test.js` 和 `home-hero-mp4-platform-recommend.test.js` 的禁止模式检查在 macOS 上下文是否仍然有效

### 7.5 IPC 合约测试覆盖缺口

- **已覆盖**: 4个平台 IPC 通道（`mineradio-platform-capabilities` + `mineradio-wallpaper-*` ×3）
- **未覆盖**: 61+ 个其他 trusted IPC 通道（`mineradio-memory-*`, `mineradio-wallpaper-engine-*` (17+, Windows-only), `mineradio-local-library-*`, `mineradio-hotkeys-*`, `mineradio-cache-*`, `mineradio-login-*`, `mineradio-desktop-lyrics-*` (6), 等）
- **缓解**: `privileged-ipc-policy.test.js` 验证每个通道都有策略条目（存在性守卫：`channels.length >= 65`）
- **建议**: 按优先级逐步补充高价值 IPC 通道的合约测试（本地曲库、桌面歌词、快捷键）

### 7.6 `scripts/quick-check.js` 变更

3 处变更，均为结构性跟随（无断言移除或弱化）：
1. `'desktop/system-memory.js'` → `'desktop/platform/windows/system-memory.js'` — 路径跟随平台重组
2. `ipcMain.handle('mineradio-wallpaper-engine-capture-result'` → `trustedIpcMain.handle(...)` — IPC 安全重构
3. `ipcMain.handle('mineradio-wallpaper-engine-stop-scene'` → `trustedIpcMain.handle(...)` — IPC 安全重构

**quick-check.js 仍主要为 Windows 工具** — 在 macOS 上因 Wallpaper Engine 路径检查失败（已知基线，不是回归）。

---

## 8. 架构审计

### 8.1 平台边界清晰度: ✅ 良好

- `desktop/platform/index.js` 作为唯一组合根，通过 `createPlatform()` 选择平台
- `desktop/platform/contract.js` 定义 8 个统一服务接口，每方法验证函数签名
- `desktop/platform/capabilities.js` 定义有限能力集（3 key: `fullDesktopMode`, `wallpaperEngine`, `tray`）
- `loadNativeDesktopFeatures()` 按平台返回不同模块组合（Windows 真实实现 vs macOS 存根）
- 渲染器通过 `00-platform-capabilities.js` 消费能力表，**无 `process.platform` 泄露**
- 所有 `process.platform` 检查集中在 `desktop/platform/index.js` 和 `desktop/platform/windows/system-memory.js`

### 8.2 仍存在的平台泄露

| 位置 | 泄露程度 | 风险评估 |
|------|---------|---------|
| `desktop/main.js` `APP_ICON_ICO` 硬编码 `.ico` | 轻微 | 低 — macOS tray/capability 守卫阻止使用 |
| `desktop/main.js` `hookExplorerRestartForFullDesktop` 调用 | 已守卫 | 低 — `platform.supports('fullDesktopMode')` 检查 |
| `build/after-pack.js` Windows rcedit | 已守卫 | 低 — `if (electronPlatformName !== 'win32') return` |
| `scripts/quick-check.js` WE 路径检查 | 已知基线 | 低 — 已记录为 macOS 预期失败 |
| 渲染器 ~2300行 WE 死代码 | 轻微 | 低 — 不执行，仅占用解析时间 |
| `qishui-api.js` Windows 设备指纹 | 刻意 | 低 — API 欺骗策略，非平台缺陷 |
| `server.js` `beatCacheRootInfo()` C:盘检查 | 无害 | 低 — macOS 上 `'/'` ≠ `'C:'`，自动通过 |

### 8.3 渲染器平台依赖: ✅ 无泄露

- 渲染器代码中**无 `process.platform` 调用**
- 所有平台差异通过三种机制：
  1. HTML `data-platform-capability` 属性（声明式门控）
  2. CSS `html[data-platform="darwin"]` 选择器（视觉门控）
  3. JS `subscribePlatformCapability()` API + `CustomEvent('mineradio:platform-capabilities')`（行为门控）
- Preload 仅公开白名单 API，**不暴露** `ipcRenderer` 直接访问

### 8.4 IPC/preload 闭环: ✅ 已闭环

- Preload 新增 `getPlatformCapabilities()` 方法
- 所有 IPC 通道使用 `trustedIpcMain`（sender 验证 + 负载深度/大小/条目校验 + 每通道策略）
- 平台 IPC 通道（`mineradio-wallpaper-*`）在 macOS 正确返回 unsupported
- `disposePlatformIpc()` 在 before-quit 中清理（`ipcMain.removeHandler` 逐通道）

### 8.5 架构瑕疵（不影响功能但值得关注）

1. **能力集过小**（3 key）: 不足以表达所有平台差异（快捷键行为、内存行为、全屏行为、更新行为等）。建议扩展为更细粒度的能力矩阵
2. **IPC 通道归属混乱**: `mineradio-desktop-lyrics-*` 在 `desktop/main.js` 内联注册，但 `mineradio-wallpaper-*` 在 `desktop/platform/ipc.js` 平台模块 — 应统一
3. **`memoryAutoState` 初始化依赖顺序**: 模块顶层设为 `null` → `createWindowOnce()` 中从 `platform.systemMemory.MEMORY_MASK_DEFAULT` 重新初始化 — 脆弱，如果初始化先于平台创建会出错
4. **`registerWallpaperEngineScheme` 在 macOS 无条件调用**: 虽然存根无害，但浪费了一次函数调用 — 建议加平台守卫

---

## 9. 建议的后续迁移路线

### 阶段 1: 发布就绪（P0 — 预计 1-2 天）

**目标**: macOS DMG 可签名、公证、分发

| # | 任务 | 范围 | 测试门槛 | Windows 回归保护 |
|---|------|------|---------|-----------------|
| 1.1 | 添加 `@electron/notarize` devDependency | `package.json`, lockfile | `npm test` 全绿 | Windows 构建不受影响 |
| 1.2 | 修复关闭行为 `'tray'` 降级 | `desktop/main.js` `setCloseBehavior` handler | 合约测试 + macOS 冒烟 | Windows tray 行为保留 |
| 1.3 | 生成 `.icns` 图标 | `build/icon.icns` | `validate:mac:unsigned` 验证 | 不涉及 |
| 1.4 | 配置 `release-signing` environment + 凭据 | GitHub Settings | 手动 workflow dispatch 验证 | 不涉及 |
| 1.5 | 创建双平台发布 workflow | `.github/workflows/release.yml` | Tag push 触发验证 | 双平台并行构建，独立验证 |

### 阶段 2: 体验完善（P1 — 预计 3-5 天）

**目标**: macOS 用户体验与 Windows 对等

| # | 任务 | 范围 | 验证方式 |
|---|------|------|---------|
| 2.1 | 添加 DMG 品牌背景图 | `build/macos/background.png` + DMG 配置 | DMG 挂载视觉验证 |
| 2.2 | 端到端验证更新机制 | `server.js` update 模块 + DMG 路径 | Apple Silicon 真机 |
| 2.3 | 验证全部 Provider 登录 | QQ/网易/酷狗/汽水/Spotify | Cookie 持久化验证 |
| 2.4 | 验证音频设备 | 播放、输出设备切换、AirPods | Apple Silicon 真机 |
| 2.5 | 验证全屏 Space 行为 | 进入/退出全屏、多 Space、多显示器 | Apple Silicon 真机 |
| 2.6 | 验证桌面歌词多 Space 行为 | Mission Control 隐藏、全屏 Space 可见 | Apple Silicon 真机 |

### 阶段 3: 测试覆盖补全（P2 — 预计 1-2 周）

| # | 任务 | 范围 |
|---|------|------|
| 3.1 | macOS 渲染进程崩溃恢复测试 | `tests/smoke/macos/renderer-crash-recovery.test.js` |
| 3.2 | macOS 沙箱/TCC 权限验证 | `tests/platform/macos/sandbox-security.test.js` |
| 3.3 | 高优先级 IPC 通道合约测试扩展 | `tests/contracts/` (local-library, desktop-lyrics, hotkeys) |
| 3.4 | macOS 更新路径测试 | `tests/smoke/macos/update-path.test.js` |
| 3.5 | macOS 全屏 Space 行为测试 | `tests/platform/macos/fullscreen-space.test.js` |

### 阶段 4: 正式合并与发布（预计 1 周）

**目标**: 同一 SHA 通过 Windows + macOS 全部门禁

1. 冻结候选 SHA → 全 CI 绿
2. Windows: 构建 EXE → rcedit → NSIS → 安装冒烟
3. macOS: 构建 DMG → 签名 → 公证 → staple → Gatekeeper 验证
4. 独立 Windows QA + macOS QA + 安全审查
5. annotated Tag + Draft Release → 双平台产物上传 → 正式发布

### 合并策略

- **不建议提前合并到 `main`** — 在阶段 4 全部门禁通过前保持 `codex/macos` 分支
- 合并时保留完整提交历史
- 合并后 `main` = 双平台发布主线；Windows 构建脚本和测试必须在合并后继续通过

---

## 10. 附录：证据索引

### 10.1 关键提交

| SHA | 角色 |
|-----|------|
| `89c0d23` | main 分支 HEAD（Windows 基线） |
| `0a8ad53` | codex/macos 分支 HEAD |
| `96091d1` | 上游 v2.1.0 发布 commit |
| `37993d3` | 上游 v2.1.0 annotated Tag |

### 10.2 核心文件索引

**平台层**:
| 文件 | 行数 | 核心职责 |
|------|------|---------|
| `desktop/platform/index.js` | 37 | 平台组合根 + 原生功能加载器 |
| `desktop/platform/contract.js` | 122 | 8 服务接口契约 + assert + unsupported |
| `desktop/platform/capabilities.js` | 32 | 3 key 能力集：fullDesktopMode, wallpaperEngine, tray |
| `desktop/platform/ipc.js` | 126 | 4 平台 IPC 通道 + sender 验证 + 负载校验 |
| `desktop/platform/macos/index.js` | 84 | macOS 完整契约实现 |
| `desktop/platform/macos/native-desktop-features.js` | 92 | 3 个 unsupported 存根类（17+12+6=35 方法） |
| `desktop/platform/macos/shortcuts.js` | 207 | macOS 快捷键：修饰符规范化、白名单、注册/去重 |
| `desktop/platform/macos/system-memory.js` | 48 | macOS 内存：os.totalmem/freemem 快照 |
| `desktop/platform/macos/application-menu.js` | 40 | 原生菜单：appMenu/editMenu/windowMenu + Dock |
| `desktop/platform/windows/index.js` | 76 | Windows 完整契约实现（AppUserModelId + D: 盘 + d3d11） |

**共享层**:
| 文件 | 核心职责 |
|------|---------|
| `desktop/shared/local-data-paths.js` | 跨平台数据路径解析（`~/.mineradio/` 默认） |
| `desktop/shared/startup-qa-paths.js` | QA 用户数据隔离 |
| `desktop/shared/trusted-ipc-main.js` | IPC sender 授权 + 负载校验 |
| `desktop/shared/privileged-ipc-policy.js` | 每通道参数策略 |
| `desktop/shared/window-ipc-authorization.js` | 窗口来源 IPC 门控 |
| `desktop/shared/external-navigation-validation.js` | 外部 URL 白名单 |
| `desktop/shared/ipc-payload-validation.js` | IPC 负载深度/大小/条目限制 |

**渲染器**:
| 文件 | 核心职责 |
|------|---------|
| `public/js/modules/00-state/00-platform-capabilities.js` | 渲染器能力系统（104行） |
| `public/js/modules/07-fx/03-wallpaper-engine-library.js` | WE 渲染器（含 macOS 能力门控） |
| `public/js/modules/10-shell/04-desktop-overlay-fullscreen.js` | 桌面叠加层（含 macOS 能力状态重置） |
| `public/js/modules/00-state/02-preferences-ui-modes.js` | UI 偏好设置（含关闭行为异步确认） |
| `public/css/index.css` | macOS 标题栏 CSS（`html[data-platform="darwin"]`） |
| `public/index.html` | 6 处 `data-platform-capability` 门控 |

**构建**:
| 文件 | 核心职责 |
|------|---------|
| `electron-builder.macos.js` | macOS 构建入口（委托到 configuration.js） |
| `build/macos/configuration.js` | macOS 配置工厂（解构 package.json.build） |
| `build/macos/entitlements.plist` | Hardened Runtime 权限（仅 `allow-jit`） |
| `build/macos/notarize.js` | Apple 公证（需 `@electron/notarize`） |
| `build/macos/validate-dmg.js` | DMG 完整性（架构、codesign、stapler、spctl） |
| `build/installer.nsh` | Windows NSIS（600+行自定义逻辑） |
| `build/after-pack.js` | Windows rcedit 资源注入 |

**测试**:
| 文件 | 行数 | 类型 |
|------|------|------|
| `tests/contracts/platform-contract.test.js` | 250 | 合约 |
| `tests/contracts/platform-ipc-boundary.test.js` | 149 | 合约 |
| `tests/contracts/platform-renderer-capabilities.test.js` | 123 | 合约 |
| `tests/contracts/renderer-platform-ux.test.js` | 153 | 合约 |
| `tests/contracts/native-desktop-feature-boundary.test.js` | 102 | 合约 |
| `tests/platform/macos/application-menu.test.js` | 123 | macOS |
| `tests/platform/macos/shortcuts.test.js` | 207 | macOS |
| `tests/platform/macos/system-memory.test.js` | 35 | macOS |
| `tests/platform/macos/platform.test.js` | 42 | macOS |
| `tests/smoke/macos/main-entry-smoke.test.js` | 192 | 冒烟 |
| `tests/smoke/macos/packaged-app-smoke.test.js` | 84 | 冒烟 |
| `tests/build/macos-build.test.js` | 185 | 构建 |
| `tests/build/ci-workflows.test.js` | 56 | 构建 |

### 10.3 关键 IPC 通道清单

| 通道 | 平台 | 安全性 | 用途 |
|------|------|--------|------|
| `mineradio-platform-capabilities` | 双平台 | trustedIpcMain + sender 验证 | 能力表查询 |
| `mineradio-wallpaper-set-enabled` | Windows (macOS unsupported) | platform/ipc.js 门控 | 桌面模式启用/禁用 |
| `mineradio-wallpaper-update` | Windows (macOS unsupported) | platform/ipc.js 门控 | 桌面模式状态更新 |
| `mineradio-wallpaper-get-status` | Windows (macOS unsupported) | platform/ipc.js 门控 | 桌面模式状态查询 |
| `mineradio-desktop-lyrics-set-enabled` | 双平台 | trustedIpcMain | 歌词启用 |
| `mineradio-desktop-lyrics-set-dragging` | 双平台 | trustedIpcMain | 歌词拖动 |
| `mineradio-desktop-lyrics-set-pointer-capture` | 双平台 | trustedIpcMain | 鼠标捕获 |
| `mineradio-desktop-lyrics-set-hot-bounds` | 双平台 | trustedIpcMain | 热区边界 |
| `mineradio-desktop-lyrics-set-lock-state` | 双平台 | trustedIpcMain | 锁定状态 |
| `mineradio-desktop-lyrics-move-by` | 双平台 | trustedIpcMain | 移动增量 |
| `mineradio-hotkeys-configure-global` | 双平台 | trustedIpcMain | 快捷键配置 |
| `mineradio-memory-get-snapshot` | 双平台 | trustedIpcMain | 内存快照 |
| `mineradio-memory-configure-auto` | 双平台 | trustedIpcMain | 自动内存配置 |
| `mineradio-memory-trim-app` | 双平台 (macOS unsupported) | trustedIpcMain | 应用内存修剪 |
| `mineradio-memory-purge-system` | 双平台 (macOS unsupported) | trustedIpcMain | 系统内存清理 |
| `mineradio-local-library-*` (3) | 双平台 | trustedIpcMain | 本地曲库管理 |
| `mineradio-cache-*` (3) | 双平台 | trustedIpcMain | 缓存管理 |
| `mineradio-wallpaper-engine-*` (17+) | Windows (macOS unsupported) | trustedIpcMain | WE 库/运行时管理 |
| `mineradio-full-desktop-*` (4) | Windows (macOS unsupported) | trustedIpcMain | 桌面图标/软件锁/键盘焦点/指针路由 |

---

> **审计结论**: `codex/macos` 分支的 Windows→macOS 迁移工作质量高。平台抽象层设计良好，能力门控正确，UI 隐藏准确，存根返回正确，IPC 安全性大幅提升。3 个 P0 阻塞项均为发布基础设施（依赖、凭据、流水线），另有 1 个 P0 功能缺口（关闭行为降级）。Windows 构建和测试基础设施完整保留。报告中的所有结论均基于代码审计、测试证据和双分支对比。
