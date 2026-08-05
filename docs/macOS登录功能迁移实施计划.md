# Mineradio macOS 登录功能迁移实施计划

## 1. 目标与最终交付

本计划用于指导 DeepSeek V4 Claude Code 在当前 `macos` 分支上完成音乐平台登录功能的 macOS 适配、验证和交付。

最终结果必须满足：

1. macOS Apple Silicon（`darwin arm64`）可以从登录面板使用网易云音乐、QQ 音乐、酷狗音乐、汽水音乐和 Spotify 的现有登录流程。
2. Windows x64 的登录行为保持不变；不重写、不删除、不修改 Windows 专用登录逻辑和 Windows 专用测试，除非测试证明某个文件实际属于共享行为且修改不可避免。
3. macOS 登录窗口使用 macOS 资源和窗口配置，不再依赖未打包的 Windows `.ico`、BMP 或 NSIS 资源。
4. 登录会话、Cookie、OAuth 配置、二维码轮询和登出流程继续隔离在本地用户数据目录，不进入仓库、测试夹具、日志或构建产物。
5. 所有可验证的代码、合约、渲染器和打包测试通过；无法在当前机器完成的真实平台登录或签名验证必须明确记录为未验证，而不是伪造通过。

本计划只覆盖登录功能迁移。壁纸引擎、Windows 桌面歌词、完整桌面模式等 macOS 不支持能力不在本计划内。

## 2. 当前实现事实

### 2.1 共享登录入口

当前登录流程已经位于共享代码，而不是 `desktop/platform/windows/`：

| 平台 | 渲染器入口 | Preload API | 主进程处理 | 认证方式 |
|---|---|---|---|---|
| 网易云音乐 | `public/js/modules/08-account/03-login-modal-flows.js` | `openNeteaseMusicLogin` / `clearNeteaseMusicLogin` | `desktop/main.js` 的 `openNeteaseMusicLoginWindow` | 官方网页登录、Cookie 导入、二维码兜底 |
| QQ 音乐 | 同上 | `openQQMusicLogin` / `clearQQMusicLogin` | `openQQMusicLoginWindow` | 官方网页登录、Cookie 导入、播放凭证 warmup |
| 酷狗音乐 | 同上 | `openKugouMusicLogin` / `clearKugouMusicLogin` | `openKugouMusicLoginWindow` | 官方网页登录、Cookie 导入、播放凭证 warmup |
| 汽水音乐 | 同上 | `clearQishuiMusicLogin` | `server.js` + `qishui-qr-login.js` | 抖音 App 官方二维码确认 |
| Spotify | 同上 | `openSpotifyMusicLogin` / `clearSpotifyMusicLogin` | `openSpotifyMusicLoginWindow` | Client ID + PKCE OAuth |

### 2.2 关键文件

- `desktop/main.js`：登录分区、登录窗口、Cookie 读取、外部导航、IPC handler、会话清理。
- `desktop/preload.js`：向渲染器暴露窄 API；不得暴露 `ipcRenderer`、Node 模块或文件系统原语。
- `server.js`：各平台状态、Cookie 路径、登录接口、汽水二维码桥接、登出。
- `qishui-qr-login.js`：汽水音乐官方二维码创建、轮询和清理。
- `public/index.html`：五个平台登录节点及登录弹窗结构。
- `public/js/modules/08-account/01-login-modal-utils.js`：平台顺序、身份和登录状态。
- `public/js/modules/08-account/02-login-status.js`：五个平台状态刷新、权益和账号数据。
- `public/js/modules/08-account/03-login-modal-flows.js`：平台选择、官方窗口、二维码、OAuth、Cookie 导入。
- `public/js/modules/08-account/04-user-modal-logout.js`：五个平台登出。
- `desktop/platform/macos/index.js`：macOS 生命周期、窗口和菜单适配；不应承载平台登录业务。
- `build/macos/configuration.js`、`electron-builder.macos.js`：macOS arm64 打包与资源边界。
- `build/macos/icon.icns`：macOS 应用图标。
- `tests/login-easter-egg-gate.test.js`：登录 IPC 和登录面板安全门测试。
- `tests/qishui-passport-qr-login.test.js`：汽水官方二维码流程测试。
- `tests/smoke/macos/`：macOS 主入口、渲染器和打包 smoke 测试。
- `tests/build/macos-build.test.js`：macOS 构建配置测试。

### 2.3 已确认的迁移缺口

`desktop/main.js` 将 `APP_ICON_ICO` 指向 `build/icon.ico`，并将该路径用于网易云、QQ、酷狗、Spotify 等登录窗口。Windows 构建需要该资源，但 macOS 配置会排除通用 `build/**/*`，因此 macOS 打包后该路径可能不存在。此问题首先表现为登录窗口图标缺失，也可能在 Electron 版本或打包环境下导致窗口创建异常，必须通过资源边界测试和打包 smoke 明确处理。

不得通过把整个 Windows `build/` 目录重新打入 macOS 包来解决，因为其中包含 `.ico`、BMP、NSIS 脚本和 Windows 打包逻辑。

## 3. 执行原则与硬性约束

1. 先分析、后设计、再实现、最后验证；每一阶段必须有输入、输出和完成标准。
2. 只支持 Windows x64 与 Apple Silicon macOS arm64；不添加 Linux、Intel macOS 或通用占位实现。
3. Windows 登录窗口、Cookie 规则、播放凭证逻辑和 Windows 测试保持原样。
4. 不增加兼容导出、fallback import、重复模块或旧路径迁移层。若替换路径，删除旧路径并更新所有调用者和测试。
5. `desktop/main.js`、`desktop/preload.js`、`package.json`、lockfile、`server.js` 只能由一个集成负责人按依赖顺序修改。
6. 任何真实账号、Cookie、Token、Client Secret、OAuth 授权码和用户媒体都不能进入日志、测试夹具、截图、提交或构建上下文。
7. 不执行 `npm audit fix`、大规模格式化或无关依赖升级。

## 4. 阶段 A：基线和差异审计

### 输入

- 当前 `macos` 分支的工作树和 HEAD。
- `main` 分支的登录相关实现。
- 当前 `package.json`、`electron-builder.macos.js`、`build/macos/`、登录测试。

### 工作项

1. 记录：
   - `git branch --show-current`
   - `git status --short`
   - `git rev-parse HEAD`
   - `node --version`、`npm --version`、Electron 版本
   - 当前 macOS 架构：`uname -m`
2. 对比 `main...HEAD` 中以下文件的登录相关差异：
   - `desktop/main.js`
   - `desktop/preload.js`
   - `server.js`
   - `public/index.html`
   - `public/js/modules/08-account/`
   - `package.json` 和 macOS builder 配置
3. 建立登录能力矩阵：
   - 打开登录窗口
   - 已有会话复用
   - 官方登录成功检测
   - Cookie 导入
   - 二维码生成和轮询
   - OAuth 回调
   - 状态刷新
   - 播放凭证/会员状态同步
   - 登出和本地凭据清理
4. 确认所有登录窗口创建处的图标、partition、sandbox、contextIsolation、nodeIntegration、导航拦截和父子窗口关系。
5. 检查 macOS 构建包内是否包含 `build/icon.ico`、是否包含 `build/macos/icon.icns`、是否包含意外的 Windows 资源。

### 输出

- `docs/` 中追加一份带日期的基线记录，或在本计划执行记录章节写入实际命令和结果。
- 一张五个平台能力矩阵。
- 一份需要修改的精确文件清单。

### 完成标准

- 能明确区分“已经共享迁移的登录业务”和“仅缺 macOS 资源/验证的部分”。
- 没有把 Windows 专用能力误判为 macOS 登录缺失。
- 发现的现有测试失败必须原样记录。

## 5. 阶段 B：设计 macOS 登录窗口资源和边界

### 5.1 资源方案

选择最简单且无兼容层的方案：

1. 将登录窗口图标从 Windows 专用 `APP_ICON_ICO` 中解耦。
2. macOS 登录窗口使用 `build/macos/icon.icns` 或明确不设置窗口图标（由 macOS 应用图标统一提供）。
3. Windows 主窗口和 Windows 登录窗口继续使用 `build/icon.ico`，不改 Windows 路径。
4. 不把 `.ico`、BMP、NSIS 文件加入 macOS 的 files 列表。
5. 如需共享路径选择逻辑，新增纯平台资源选择函数，并在 Windows/macOS 两个 adapter 中各自提供结果；不得在共享业务中散落 `process.platform` 判断。

### 5.2 窗口安全设计

所有五个平台登录窗口必须继续满足：

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`（除非 Electron 的实际登录站点必须放宽；放宽前必须给出证据和安全评审）
- 使用独立 `persist:` partition，互不共享 Cookie
- 主窗口关闭、登录取消、窗口销毁、加载失败时清理 timer 和子窗口
- 仅允许平台所需的官方 HTTPS 域名导航
- 非官方外链使用 `shell.openExternal`，不得在登录窗口内任意导航
- `setWindowOpenHandler` 不得允许未经验证的 URL
- 发送者必须是受信任的主窗口；IPC 参数必须校验

### 5.3 平台差异

- 网易云、QQ、酷狗、Spotify 登录窗口可以在 macOS 复用现有 BrowserWindow 流程，但必须验证 macOS modal/parent、traffic-light、关闭行为。
- 汽水音乐没有独立 BrowserWindow 登录流程，继续使用应用内官方二维码；不得恢复旧的 Cookie/token 登录 IPC。
- Spotify OAuth 回调继续使用 `127.0.0.1` 回调和 PKCE，不引入 Client Secret。

### 输出

- 资源选择设计说明。
- 登录窗口安全检查清单。
- 五个平台逐项的成功、取消、失败和清理状态图。

### 完成标准

- 集成负责人和安全审查者确认设计不会改变 Windows 行为。
- 设计没有引入兼容层或未实现的回退路径。

## 6. 阶段 C：实现 macOS 资源适配

### 允许修改的文件

- `desktop/main.js`：仅修改登录窗口资源选择和必要的 macOS 窗口选项；保持登录算法和 Windows 分支不变。
- `desktop/platform/index.js` 或新的 macOS 平台资源模块：只负责平台资源/窗口配置组合。
- `desktop/platform/macos/`：如确有需要，增加 macOS 登录窗口配置函数。
- `build/macos/configuration.js`、`electron-builder.macos.js`：确保 macOS 只使用 ICNS 和 macOS 资源。
- `tests/platform/macos/`、`tests/contracts/`、`tests/build/`：增加 macOS/共享合约测试。
- `docs/`：更新实施记录和验证结果。

### 禁止修改

- `desktop/platform/windows/`，除非编译错误证明接口变更必须同步；同步时只做最小接口适配。
- Windows 登录实现、Windows 登录测试、NSIS 配置、`build/after-pack.js` 的 Windows 行为。
- Provider API、Cookie 算法、VIP/播放凭证算法，除非测试发现与平台无关的明确 bug；这类变更必须另开任务说明。

### 实现步骤

1. 为登录窗口构造统一的、可注入的窗口选项函数。
2. 让 Windows 选项继续返回原有 `.ico` 路径。
3. 让 macOS 选项返回 `icon.icns`（或安全地省略 icon）。
4. 将网易云、QQ warmup/弹窗、酷狗和 Spotify 的窗口创建改为调用该选项函数。
5. 不改变 partition、URL、Cookie 读取顺序、轮询间隔、成功判定和错误码。
6. 检查所有异常路径：`loadURL` 失败、站点拒绝、用户关闭、父窗口销毁、子窗口关闭、重复完成、timer 清理。
7. 对 `APP_ICON_ICO` 的其他用途逐一检查，不能把 macOS 路径误用于托盘、安装器或 Windows 资源。
8. 确认 macOS 打包 files 不包含 Windows 专用文件，并且应用内仍包含业务代码、`qishui-qr-login.js`、Provider API 和必要的 macOS 资源。

## 7. 阶段 D：补充测试

### 7.1 共享单元测试

不复制 Windows 原生测试；只测试跨平台行为：

- 五个平台 provider key、显示名和顺序。
- 登录状态标准化和状态刷新失败保留行为。
- Cookie 导入输入校验、长度限制和 provider 隔离。
- 登出清理目标文件/partition，不删除其他平台凭据。
- Spotify OAuth 配置只保存 Client ID，不保存 Client Secret。
- 汽水旧 token/cookie 路径保持删除状态，只有官方二维码接口可用。

建议放在现有共享测试目录，或扩展已有：

- `tests/login-easter-egg-gate.test.js`
- `tests/qishui-passport-qr-login.test.js`
- Provider 现有 entitlement/status 测试

### 7.2 平台合约测试

新增或扩展 `tests/platform/macos/`：

- macOS 登录窗口资源不引用 `build/icon.ico`。
- macOS 资源路径只允许 `build/macos/icon.icns` 或明确的空 icon。
- macOS 登录窗口保留 sandbox、contextIsolation 和 nodeIntegration 设置。
- macOS login window 配置不会启用 Windows 的 desktop mode、Wallpaper Engine 或 HWND 逻辑。
- macOS 取消、关闭和加载失败都能清理 timer/子窗口。

扩展 `tests/contracts/`：

- preload 暴露五个平台登录 API，且不暴露 `ipcRenderer`。
- 登录 IPC handler 全部经过 trusted sender 检查和登录彩蛋门。
- Provider 清理接口的返回值为有界、可序列化对象。
- 登录相关外部导航遵守官方域名白名单。

### 7.3 构建测试

扩展 `tests/build/macos-build.test.js`：

- macOS 配置目标为 `dmg` + `arm64`。
- macOS 图标为 `build/macos/icon.icns`。
- macOS files 不包含 `build/icon.ico`、BMP、NSIS 文件或 Windows 原生实现。
- 必须包含登录所需的业务文件和 `qishui-qr-login.js`。
- 不能包含 `.cookie`、`.env`、token、用户数据、日志和本机绝对路径。

### 7.4 Electron smoke

使用现有 macOS smoke 入口和临时 userData：

- 启动主窗口。
- 打开登录面板并切换五个平台。
- 验证五个平台 UI 均存在且没有 JS 异常。
- 模拟登录 API 成功、取消、超时和失败，验证 UI 状态恢复。
- 验证登出后只清理对应 provider。
- 验证主窗口关闭不会遗留登录窗口、子窗口或 timer。

Smoke 禁止读取或修改真实用户目录、真实 Cookie、真实 OAuth 状态。

## 8. 阶段 E：macOS 实机验证

### 必须在 Apple Silicon macOS 上执行

1. `uname -m` 必须为 `arm64`。
2. 使用临时测试用户数据目录启动应用。
3. 依次验证：
   - 网易云扫码/网页登录、取消、重新打开、登出。
   - QQ 登录、播放凭证 warmup、会员状态刷新、登出。
   - 酷狗登录、播放 token warmup、部分登录状态、登出。
   - 汽水二维码生成、扫码确认、轮询超时、清理。
   - Spotify Client ID 保存、OAuth 授权、拒绝授权、回调失败、登出。
4. 检查多窗口行为：主窗口最小化、切换 Space、关闭主窗口、重新打开登录窗口。
5. 检查 macOS 窗口图标、标题栏、traffic-light、焦点和父子窗口关系。
6. 每个真实账号验证结束后执行对应登出并删除临时 userData。

### 网络或平台限制

如果 provider 风控、地区、账号、网络或 OAuth 配置导致无法完成真实登录：

- 记录平台、时间、错误码、URL 阶段和复现命令。
- 使用合成响应完成逻辑 smoke，但标为“模拟通过”。
- 不把 Cookie、二维码内容、授权码或个人资料写入日志。
- 不把模拟通过描述成真实登录通过。

## 9. 命令与验证顺序

在仓库根目录执行：

```bash
npm install
node scripts/quick-check.js
npm test
npm run test:platform
npm run test:build
npm run test:smoke:macos
npm run build:mac:unsigned
npm run validate:mac:unsigned
npm run test:smoke:macos:package
```

如果当前 `package.json` 没有其中某个命令，先检查现有脚本和文档，不得自行宣称命令存在；必要时由本任务补充最小脚本并同步测试。

验证时记录：

- commit SHA、分支、操作系统和架构
- Node、npm、Electron 版本
- 每条命令的完整结果和通过/失败/跳过数量
- DMG 路径、架构检查结果和校验值
- 未完成的真实登录、签名、公证或人工 QA 项

## 10. 验收标准

### 功能验收

- [ ] macOS 登录面板显示五个平台。
- [ ] 网易云、QQ、酷狗官方登录窗口可打开、成功、取消和重试。
- [ ] 汽水二维码只走官方抖音扫码流程。
- [ ] Spotify OAuth 使用 PKCE，Client Secret 不进入客户端。
- [ ] 五个平台登出互不影响。
- [ ] 已有登录状态可以复用，状态刷新失败不会误报为成功登录。

### macOS 适配验收

- [ ] macOS 登录窗口不依赖 `build/icon.ico`、BMP 或 NSIS 文件。
- [ ] macOS 包使用 `build/macos/icon.icns` 或经验证的无 icon 配置。
- [ ] macOS 窗口保留安全 WebPreferences。
- [ ] 登录窗口和子窗口在取消、关闭和异常时全部清理。
- [ ] macOS 未调用 Windows HWND、WorkerW、DWM、PowerShell 或 Wallpaper Engine。

### Windows 回归验收

- [ ] Windows x64 登录窗口、Cookie 导入、QQ/Kugou warmup 和 Spotify OAuth 行为未改变。
- [ ] Windows 相关测试未被删除、跳过或改写为 macOS 模拟。
- [ ] Windows 快速检查和已有 Windows smoke 在 Windows 主机上通过；不能在 macOS 上冒充 Windows 实机通过。

### 安全验收

- [ ] 登录窗口启用 context isolation、禁用 node integration，并保持 sandbox。
- [ ] 外部导航和 IPC sender/input 校验通过。
- [ ] 构建产物无 Cookie、Token、环境变量、用户数据、日志和绝对本机路径。
- [ ] 不提交真实账号、Cookie、OAuth 授权码、音频或二维码截图。

## 11. 风险与处理

| 风险 | 影响 | 处理 |
|---|---|---|
| Provider 登录页在 Electron 中被风控 | 无法真实登录 | 保留官方网页流程；记录失败阶段；使用脱敏模拟测试验证控制流 |
| macOS 应用无 Developer ID | 无法完成正式发布 | 可做明确标注的 unsigned DMG；签名/公证留为阻塞项 |
| Electron 登录页需要跨域弹窗 | 登录失败或窗口空白 | 逐个 provider 审核白名单和 `did-create-window`；不要全局放开外链 |
| Windows 资源路径被共享改动 | Windows 回归 | 使用平台资源函数；Windows 分支保持原返回值并在 Windows 主机验证 |
| macOS builder 误打入 Windows 文件 | 包体污染或安全风险 | 构建文件清单测试和 DMG 内容扫描 |
| OAuth 回调端口被占用 | Spotify 登录失败 | 返回稳定错误码，关闭授权窗口并允许重试；不增加静默端口回退 |
| 登录 timer/子窗口泄漏 | 长时间运行和退出异常 | 所有完成、取消、异常、父窗口销毁路径统一清理并测试 |

## 12. 提交和交付步骤

1. 只查看和保留本任务相关 diff：`git diff --check`、`git diff --stat`、`git status --short`。
2. 扫描 staged 文件和 macOS 构建上下文中的凭据、绝对路径、媒体和生成产物。
3. 运行所有适用的共享、合约、macOS smoke、构建和验证命令。
4. 先由集成负责人审查 `desktop/main.js`、`desktop/preload.js`、IPC 和构建配置。
5. 由独立 Windows 审查者确认 Windows 行为和测试未被破坏。
6. 由独立 macOS 审查者确认 arm64 窗口、资源、登录流程和清理。
7. 使用简短提交信息提交，只提交任务文件；不要提交 `dist/`、日志、用户数据、Cookie、测试缓存或临时文件。
8. 推送当前迁移分支；如果推送、签名、真实登录或实机 QA 被阻塞，报告精确原因，不得声称全部完成。

## 13. 可直接交给 Claude Code 的执行提示词

```text
请在 Mineradio 当前 macos 分支执行 docs/macOS登录功能迁移实施计划.md。

先阅读仓库根目录 AGENTS.md、该计划和现有登录相关代码，确认当前分支、HEAD、工作树、Node/Electron 版本和 macOS 架构。严格按“基线审计 → 设计 → 实现 → 测试 → macOS arm64 验证 → 交付”顺序执行，不要直接重写登录业务。

核心目标：保留并验证网易云音乐、QQ 音乐、酷狗音乐、汽水音乐、Spotify 五个平台在 macOS 上的登录功能；修复登录窗口对 Windows build/icon.ico 的依赖，使 macOS 使用 macOS 资源或经过验证的无 icon 配置；保持 Windows x64 行为、Windows 测试、Windows 资源和 Windows 原生实现不变。

硬性要求：
1. 不添加 Linux 或 Intel macOS 支持。
2. 不修改 Windows 测试文件；只有证明是共享行为且不可避免时才修改共享测试。
3. 不添加兼容层、fallback import、重复模块或旧路径迁移。
4. 不把整个 Windows build 目录打入 macOS 包。
5. 保持 contextIsolation=true、nodeIntegration=false、sandbox=true、独立 persist partition、官方 HTTPS 白名单、trusted IPC sender/input 校验和所有 cleanup 行为。
6. 不读取、记录、提交真实 Cookie、Token、OAuth 授权码、Client Secret、用户数据或本机媒体。
7. 修改 desktop/main.js、desktop/preload.js、package.json 或 lockfile 前先检查现有调用者和测试，按最小 diff 实现。

请实现计划中列出的 macOS 资源适配、窗口安全/清理测试、构建内容测试、macOS Electron smoke，并运行所有适用命令。对真实 provider 登录、Developer ID、notarization 或 Windows 实机无法验证的项目，明确列为未验证/阻塞，不要伪造通过。

完成前检查 git diff --check、git status、staged 文件和构建内容；只提交任务相关文件，使用简洁提交信息并推送当前分支。最终报告必须列出：修改文件、Windows 未改动证明、每条命令结果、macOS arm64 结果、真实登录结果、未验证项、commit SHA 和推送状态。
```

