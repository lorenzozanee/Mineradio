# Mineradio macOS 迁移与跨平台适配方案

> 状态：讨论结论与执行草案
> 当前目标：以 Mineradio 最新可信稳定版为基线，交付 Apple Silicon macOS 版本，同时建立可复用的平台适配骨架。
> 长期目标：Windows 与 macOS 使用同一套业务源码、测试体系和发布主线；未来新增其他平台时只增加平台实现和构建配置。

## 1. 背景与核心判断

Mineradio 是以 JavaScript 为主的 Electron 桌面应用。Electron 本身支持 Windows、macOS 和主流桌面 Linux，但“使用 Electron”不代表应用自动跨平台。

Mineradio 当前代码大致可分为两类：

- 跨平台部分：音乐搜索与播放、歌词、粒子视觉、3D UI、歌单、账号、网络接口和大部分本地曲库逻辑。
- Windows 专属部分：HWND、WorkerW、Progman、DWM、Wallpaper Engine、PowerShell、NSIS、`.ico` 和 `rcedit.exe` 等。

因此，核心播放器迁移到 macOS 的难度可控，但完整复制 Windows 桌面嵌入能力并不简单。正确方向不是复制一套 Mac 源码，而是在一个仓库中建立共享业务层和平台适配层。

## 2. 已确定的迁移策略

### 2.1 从最新可信稳定版开始

不逐个重做历史 Tag。执行时先确认上游最新可信稳定 Tag，以它作为首次迁移基线。旧版本仅用于理解设计背景、缺陷修复和行为变化，不重新发布已经废弃的历史版本。

首次迁移：

```text
上游最新可信稳定 Tag
        ↓
建立平台适配骨架
        ↓
保留并验证 Windows 行为
        ↓
实现 Apple Silicon macOS
        ↓
双平台测试与原生构建
        ↓
发布跨平台版本
```

后续上游发布新 Tag 时，只分析前后两个 Tag 的增量：

```bash
git fetch upstream --tags
git log --oneline upstream/<old-tag>..upstream/<new-tag>
git diff --stat upstream/<old-tag> upstream/<new-tag>
git diff upstream/<old-tag> upstream/<new-tag>
```

### 2.2 同一主线，不长期维护 Mac 分叉

`feat/macos` 或 `feat/platform-foundation` 只作为迁移期开发分支。稳定后合并回主线，由同一个版本同时构建 Windows EXE 和 Apple Silicon DMG。

不要长期维护互相分叉的 `windows-code`、`mac-code` 两套业务源码，也不要按 CPU 架构复制代码。

### 2.3 区分三个维度

```text
共享业务逻辑
├── 操作系统：Windows / macOS
├── CPU 架构：x64 / arm64
└── 发布产物：EXE / DMG
```

macOS 实现不应区分 Intel 与 Apple Silicon 业务逻辑；架构差异应主要由构建配置和原生依赖处理。

## 3. 平台适配骨架

建议目标结构：

```text
desktop/
├── main.js
├── preload.js
├── shared/
│   ├── lifecycle.js
│   ├── local-music.js
│   ├── shortcuts.js
│   └── window-state.js
└── platform/
    ├── index.js
    ├── contract.js
    ├── capabilities.js
    ├── windows/
    │   ├── index.js
    │   ├── desktop-mode.js
    │   ├── wallpaper-engine.js
    │   └── system-memory.js
    └── macos/
        ├── index.js
        ├── application-menu.js
        ├── desktop-mode.js
        └── system-memory.js

build/
├── shared/
├── windows/
└── macos/

tests/
├── shared/
├── contracts/
├── platform/
│   ├── windows/
│   └── macos/
└── smoke/
    ├── windows/
    └── macos/
```

当前只实现 Windows 与 macOS。不要为尚未计划交付的 Linux 编写猜测性空壳；以后真正支持 Linux 时再增加实现。

### 3.1 平台契约

共享代码只依赖统一的平台接口，不直接调用 HWND、DWM、Dock 等系统能力。

示意：

```js
const platform = require('./platform');

platform.configureApp(app);
platform.configureWindow(mainWindow);

if (platform.capabilities.fullDesktopMode) {
  await platform.desktopMode.enable(mainWindow);
}
```

每个平台明确报告能力：

```js
// Windows
capabilities: {
  fullDesktopMode: true,
  wallpaperEngine: true,
  desktopLyrics: true
}

// macOS 初始版本
capabilities: {
  fullDesktopMode: false,
  wallpaperEngine: false,
  desktopLyrics: true
}
```

不支持的能力必须隐藏入口，或返回明确的 `unsupported` 结果，不能静默失败。

### 3.2 跨平台开发规则

建议写入仓库 `AGENTS.md` 或 `docs/CROSS_PLATFORM.md`：

1. 共享业务代码不得直接依赖操作系统 API。
2. Windows 专属代码只能位于 Windows 平台模块和 Windows 构建目录。
3. macOS 专属代码只能位于 macOS 平台模块和 macOS 构建目录。
4. 平台能力必须通过统一契约访问。
5. 不在共享模块中散落大量 `process.platform` 判断。
6. 路径必须使用 `node:path`，不得手工拼接 `\\` 或 `/`。
7. 通用快捷键优先使用 `CommandOrControl`；平台差异必须有测试。
8. 新依赖必须检查目标 OS、CPU 架构和 Electron ABI 支持情况。
9. 不支持的功能必须有明确的能力状态和 UI 行为。
10. 每个 PR 必须通过 Windows 与 macOS 的共享测试和平台测试。
11. 正式产物必须在对应的原生 CI runner 上构建。
12. 平台特有功能必须在目标系统真机验收。

## 4. 多 Agent 协作模型

两名实现 Agent 只覆盖了“写代码”，遗漏了上游审计、平台契约、Renderer 能力适配、独立测试、原生构建、签名公证和发布验收。首次迁移建议定义十一个职责角色，但角色不等于十一个常驻 Agent：它们按阶段启用，同一个 Agent 可以在不破坏独立性的前提下承担相邻阶段的职责。

协调者始终负责集成。在四个并发槽的限制下，每一波最多并行三个子 Agent。

### 4.1 Agent 职责


| Agent                       | 核心职责                                                                       | 主要交付物                             |
| --------------------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| 0. 架构、协调与集成 Agent   | 决策、能力契约、IPC 边界、任务拆分、文件所有权、接线、合并与冲突处理           | ADR、平台接口、集成分支、最终决策      |
| 1. 上游差异审计 Agent       | 固定 Tag/commit SHA，比较快照、依赖、测试、新增/删除/重命名及 Windows 假设     | 迁移清单、风险清单、上游提交映射       |
| 2. 测试架构 Agent           | 分类现有测试，建立 shared/contract/platform/smoke 测试和标准脚本               | 测试规格、失败基线、追踪矩阵和验收条件 |
| 3. 共享实现 Agent           | 迁移播放器、歌词、API、本地曲库、缓存和通用 Electron 逻辑                      | 跨平台共享实现                         |
| 4. Windows 平台 Agent       | 抽离并保留 HWND、WorkerW、DWM、Wallpaper Engine、PowerShell 等行为             | Windows 平台模块和回归测试             |
| 5. macOS 平台 Agent         | 实现 Apple Silicon 的窗口、菜单、Dock、快捷键、权限和桌面歌词                  | macOS 平台模块和平台测试               |
| 6. Renderer 能力与 UX Agent | 消费能力表，隐藏 Windows-only 入口，适配 Command/Ctrl、菜单文案和不可用状态    | 跨平台 UI 行为和 Renderer 测试         |
| 7. CI、构建与签名 Agent     | 双平台 runner、builder 配置、EXE/DMG、签名、公证、校验和与候选产物             | CI 流水线和签名候选包                  |
| 8. Windows QA Agent         | 在真实 Windows 环境验证安装、桌面模式、Wallpaper Engine、多屏和回归            | Windows 验收报告                       |
| 9. macOS ARM64 QA Agent     | 在真实 Apple Silicon 环境验证安装、菜单、窗口、权限、音频、Space 和 Gatekeeper | macOS 验收报告                         |
| 10. 发布完整性与安全 Agent  | 独立验证同一 SHA、产物清单、签名、哈希、依赖与敏感信息，不实现功能             | 发布准入/拒绝报告                      |

测试架构 Agent 不实现其负责证明的功能；发布完整性与安全 Agent 不自行修复失败。这样避免“自己写实现、自己证明正确”。真机体验仍需要人工观察，Agent 可以自动化检查和记录结果，但不能替代对窗口层级、声音、权限提示和多显示器行为的体验验收。

### 4.2 分阶段并行

#### 阶段 A：基线、契约与测试设计

协调 Agent 设计契约；以下三个子 Agent 并行：

- 上游差异审计 Agent；
- 测试架构 Agent；
- CI/依赖与构建可行性审计 Agent。

协调 Agent 汇总结果并冻结第一阶段的平台契约。未冻结契约前，不开始大规模文件搬迁。

#### 阶段 B：核心实现

以下三个子 Agent 使用独立 branch/worktree 并行：

- 共享实现 Agent；
- Windows 平台 Agent；
- macOS 平台 Agent。

协调 Agent 只负责公共入口接线，不和子 Agent 争抢其所有文件。

#### 阶段 C：界面、测试基础设施和 CI

以下三个子 Agent 并行：

- Renderer 能力与 UX Agent；
- 测试架构 Agent 完成测试编排和 Electron smoke；
- CI、构建与签名 Agent 完成双平台流水线。

#### 阶段 D：独立验证与发布

以下三个子 Agent 并行验收同一候选 commit 和候选产物：

- Windows QA Agent；
- macOS ARM64 QA Agent；
- 发布完整性与安全 Agent。

协调 Agent 根据三份验收报告决定创建新 RC、退回修复或发布正式 Tag。

### 4.3 文件所有权


| 路径                                                            | 所有者                                               |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| `desktop/main.js`、`desktop/preload.js`                         | 架构、协调与集成 Agent                               |
| `desktop/platform/index.js`、`contract.js`、`capabilities.js`   | 架构、协调与集成 Agent                               |
| `desktop/shared/`、共享 API 和纯业务模块                        | 共享实现 Agent                                       |
| `desktop/platform/windows/`、Windows 脚本                       | Windows 平台 Agent                                   |
| `desktop/platform/macos/`、macOS 资源                           | macOS 平台 Agent                                     |
| 平台相关`public/` UI 入口、文案和能力状态                       | Renderer 能力与 UX Agent                             |
| `tests/shared/`、`tests/contracts/`、`tests/smoke/`、测试编排器 | 测试架构 Agent                                       |
| `tests/platform/windows/`、`tests/platform/macos/`              | 对应平台 Agent 编写，测试架构 Agent 审查             |
| `.github/workflows/`、builder 配置、构建资源与发布脚本          | CI、构建与签名 Agent                                 |
| `package.json`、锁文件、版本字段                                | 集成 Agent 最终所有；构建 Agent 通过单独提交提出变更 |

`desktop/main.js` 和 `desktop/preload.js` 当前体积大、职责混合，是最高冲突区域，不能让共享、Windows、macOS 三个 Agent 同时修改。其他 Agent 只提交模块和接入说明，由集成 Agent 接线。移动旧模块时同步修改所有调用与测试，不保留旧路径兼容导出。

### 4.4 分支和 worktree

首次骨架：

```text
feat/platform-foundation       # 集成分支
├── port/baseline-tests
├── port/baseline-shared
├── port/baseline-windows
├── port/baseline-macos
├── port/baseline-renderer
└── port/baseline-release
```

后续同步新 Tag 时，集成分支必须从我们自己的 `main` 创建，以保留平台骨架，不能直接从新的上游 Tag 创建：

```text
main
└── sync/upstream-<new-tag>
    ├── port/<new-tag>-tests
    ├── port/<new-tag>-shared
    ├── port/<new-tag>-windows
    ├── port/<new-tag>-macos
    └── port/<new-tag>-release
```

各实现 Agent 使用独立 worktree。合并顺序由依赖决定，不以 Agent 完成时间决定；临时测试分支可以包含预期失败测试，进入集成分支的每一个提交必须保持当前阶段门禁通过。

### 4.5 后续 Tag 动态启用 Agent

首次建立平台骨架时启用全部职责。以后不固定启动所有 Agent，由差异审计结果决定：

- 只有播放器/API 变化：共享实现 + 测试架构；
- 有 Windows 原生变化：增加 Windows 平台与 Windows QA；
- 涉及平台能力入口：增加 Renderer UX；
- 涉及 Electron、依赖、安装包或发布：增加 macOS、构建签名和发布安全；
- 无论改动大小，集成 Agent 和与目标平台相关的最低回归门禁始终保留。

### 4.6 模型与推理强度路由

Agent 不固定绑定同一种模型。应根据任务的机械程度、系统风险和判断复杂度选择模型，并允许在遇到异常时升级。


| 任务类型                              | 首选模型          | 典型任务                                                           |
| ------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| 机械、边界明确、容易自动验证          | Luna High         | 文件分类、固定格式清单、批量路径更新、测试目录搬迁、产物清单与哈希 |
| 子 Agent 接口暂不能指定 Luna 时的回退 | Terra Medium/High | 调度接口只暴露 Sol/Terra 时承担上述工作                            |
| 中等复杂度设计与实现                  | Terra High        | Tag 差异分类、测试转换、共享模块提取、Renderer 能力适配、CI 配置   |
| 高风险架构与跨模块集成                | Sol Medium        | 平台契约、IPC 安全边界、`main.js`/`preload.js` 接线、复杂冲突处理  |
| 平台原生问题                          | Sol Medium        | WorkerW/DWM、macOS 窗口层级、权限、签名公证和难以复现的系统问题    |
| 独立发布安全终审                      | Sol Medium        | 同一 SHA 证明、签名链、敏感信息、更新边界和发布准入                |

建议 Agent 路由：

- 上游差异审计：Terra High；纯清单生成可下放 Luna High。
- 测试架构：Terra High；机械改名和目录整理可下放 Luna High。
- 共享实现：Terra High；明确的批量迁移可用 Luna High。
- Windows/macOS 平台实现：Terra High 起步，涉及原生系统行为时切换 Sol Medium。
- Renderer UX：Terra High；纯文案和入口批量处理可用 Luna High。
- CI/构建：Terra High；签名、公证和凭据边界由 Sol Medium 复核。
- Windows/macOS QA：Luna High 可执行固定检查表，异常诊断切换 Terra High 或 Sol Medium。
- 架构集成与发布安全：使用 Sol Medium；范围明确的复查可使用 Sol Light，但不能下放给低成本模型独立作出发布决定。

模型降级不能降低质量门禁。机械任务必须有确定输入、限定文件范围、明确输出格式和自动验证；低成本模型遇到契约歧义、跨平台行为差异、测试与实现冲突、签名失败或无法解释的回归时，必须停止修改并升级给更强模型。

Codex UI 已提供 5.6 Luna。需要区分“产品界面可选择的模型”和“当前子 Agent 调度接口允许显式指定的模型”：本方案优先为机械任务选择 Luna High；如果某次调度接口只暴露 Terra 和 Sol，则采用以下回退：

```text
机械任务 → Terra Medium/High
一般设计与实现 → Terra High
范围明确的检查与轻量复核 → Sol Light
关键架构、原生疑难和发布安全 → Sol Medium
```

本方案不使用 Sol High 或 XHigh。复杂任务通过缩小单次改动范围、增加契约测试、独立 Agent 复核和逐级质量门禁控制风险，而不是提高 Sol 的推理强度。

说明：Codex UI 将轻量推理显示为 `Light`；部分 Agent 调度接口的参数名称可能显示为 `low`，执行时以对应接口的合法枚举为准。

## 5. 测试策略

当前上游测试基础设施本身就是迁移任务的一部分：`package.json` 没有标准 `test` 脚本，约 30 个测试文件平铺在 `tests/`，`scripts/quick-check.js` 同时承担大量源码守卫和测试编排，仓库也没有现成的双平台 GitHub Actions。部分真实主入口冒烟还直接依赖 Windows 环境变量和路径。平台重构前必须先记录 Windows 原版基线，再逐步把脆弱的源码正则检查改为可注入依赖的行为测试。

### 5.1 不机械复制 Windows 测试

Windows 测试应先被分类：

- 如果描述业务行为，抽成共享测试；
- 如果描述统一平台接口，抽成契约测试；
- 如果依赖 HWND、WorkerW、DWM，保留为 Windows 测试；
- 如果 macOS 有不同实现，为 macOS 的真实行为编写独立测试；
- 如果 macOS 不支持该能力，测试其能力状态、UI 隐藏和明确错误结果。

示例：

```text
“启用完整桌面模式”
├── 契约测试：调用后必须返回结构化结果
├── Windows 测试：窗口成功挂载到桌面宿主
└── macOS 测试：报告 unsupported，入口不可用且应用不崩溃
```

### 5.2 测试层级

1. 共享单元测试：播放队列、歌词解析、账号/API、本地数据、状态管理。
2. 平台契约测试：能力表、统一返回值、生命周期、错误语义和清理行为。
3. Windows 平台测试：完整桌面模式、Wallpaper Engine、Windows 快捷键和窗口行为。
4. macOS 平台测试：菜单、Dock、窗口、文件权限、快捷键、桌面歌词。
5. Electron 冒烟测试：启动、加载主页、基本播放流程、退出与重启。
6. 安装包测试：EXE 安装/卸载，DMG 挂载/拖入 Applications/首次启动。
7. 真机验收：音频设备、媒体键、多显示器、全屏、睡眠恢复、性能和权限体验。

Windows QA 与 macOS QA 必须分开：macOS 上的 mock 不能证明 WorkerW 正常，Windows 上的测试也不能证明 Dock、Space、Gatekeeper 或 macOS 窗口层级正确。

### 5.3 测试先于实现

每个上游增量先由差异审计 Agent 说明“发生了什么”，再由测试架构 Agent 把行为转成测试或验收条件，然后才由实现 Agent 编码。

测试初始失败是预期状态，但必须能证明失败来自尚未实现的目标行为，而不是测试本身错误。

测试 Agent还应维护一张可追踪矩阵：

```text
上游 Tag diff
    ↓
功能或行为变化
    ↓
shared / contract / Windows / macOS / smoke
    ↓
自动测试，或必须真机验收的书面理由
```

## 6. 上游 Tag 同步流程

建议配置：

```bash
git remote add upstream https://github.com/XxHuberrr/Mineradio.git
git fetch upstream --tags
```

每次同步新 Tag：

1. 固定旧 Tag、新 Tag 和对应的精确 commit SHA，不依赖 Release 页面上的 `target_commitish`。
2. 验证新 Tag 是否为旧 Tag 的后代；若不是，停止自动同步并人工审查分叉来源。
3. 审查完整 Tag 快照，不只阅读 commit 标题；一个 Release commit 也可能包含大量代码和测试变化。
4. 检查 commit 列表、文件状态、重命名、依赖锁文件和测试变化。
5. 将差异分类为 `shared`、`windows`、`macos-impact`、`renderer`、`build`、`test`、`docs`。
6. 记录被删除或替换的旧路径；不要保留过时兼容层。
7. 更新共享/契约/平台测试。
8. 分配实现 Agent 和明确文件所有权。
9. 合并后运行双平台 CI 和安装包冒烟。
10. 全部门禁通过后发布对应版本。

建议审计命令：

```bash
git fetch upstream --tags --prune
git rev-parse refs/tags/<old-tag>^{commit}
git rev-parse refs/tags/<new-tag>^{commit}
git merge-base --is-ancestor <old-sha> <new-sha>
git log --reverse --oneline <old-sha>..<new-sha>
git diff --name-status <old-sha> <new-sha>
git diff --stat <old-sha> <new-sha>
git diff --find-renames <old-sha> <new-sha>
```

每个上游 commit 不必机械对应一个本仓库 commit。迁移清单必须保存“上游 commit → 本地实现/无需处理/平台替代”的映射，以便追踪遗漏。

## 7. Git、版本与 Tag

### 7.1 正确顺序

```text
实现与本地测试
      ↓
提交并推送功能分支
      ↓
PR 双平台 CI
      ↓
合并到集成/主分支
      ↓
版本与发布说明 commit
      ↓
从精确 commit SHA 构建签名候选 EXE 与 DMG
      ↓
候选安装包、真机和安全完整性验收
      ↓
在同一 commit SHA 创建不可变 annotated Tag
      ↓
将已经验收的同一批产物附加到 Draft Release
      ↓
发布正式 Release
```

不要在构建和安装验证前创建正式 Tag，也不要在打 Tag 后悄悄重建并替换为未经测试的产物。Tag 应指向产生已验收候选包的同一 commit，正式 Tag 不移动、不删除；失败时创建新的 RC 或 port revision。

### 7.2 版本命名

上游 Tag 与本项目发布 Tag 必须可区分，避免和同步进来的上游 Tag 冲突。例如：

```text
上游：v2.1.0
候选：v2.1.0-cross.1-rc.1
正式：v2.1.0-cross.1
```

最终命名在首次发布前确定，并同步到 `package.json`、产物名、更新逻辑和 Release 文档。公开 SemVer 与平台内部数字版本应分开设计：Windows FileVersion 和 macOS CFBundleVersion 可能要求纯数字，不能直接假设 `2.1.0-cross.1` 可原样写入所有系统版本字段。

示例映射：

```text
公开 SemVer：2.1.0-cross.1
Windows FileVersion：2.1.0.1
macOS CFBundleShortVersionString：2.1.0
macOS CFBundleVersion：对应的递增数字构建号
```

## 8. CI、构建与发布

### 8.1 原生构建矩阵

```text
Windows runner
├── 共享测试
├── Windows 平台测试
├── Electron 冒烟
└── 生成 EXE

Apple Silicon macOS runner
├── 共享测试
├── macOS 平台测试
├── Electron 冒烟
├── 签名与公证
└── 生成 DMG
```

正式 EXE 在 Windows 环境生成；正式 DMG 在 macOS 环境生成。Apple Silicon job 必须验证运行环境和输出架构为 `arm64`。

### 8.2 PR 与 Release 流水线分离

PR 流水线：

- lint/静态检查；
- 共享和平台测试；
- Electron 启动冒烟；
- 可选的未签名候选包构建；
- 不发布 Release。

Tag/Release 流水线：

- 重跑全部测试；
- 从干净环境构建；
- 进行 macOS 签名、公证和 stapling；
- 按正确顺序修改并签名 Windows 主程序与安装器；
- 生成并校验 EXE、DMG、文件清单和哈希；
- 两个矩阵构建 job 只上传 Actions artifacts，不直接竞争发布 Release；
- 由唯一 publisher job 收集已验收产物并附加到 Draft Release；
- 不复用来源不明的旧 `dist/`。

签名密钥、Apple 凭据和 Windows 证书只存储在 CI secrets 中，不写入仓库或日志。

当前 Windows `after-pack.js` 会使用 `rcedit` 修改 EXE 资源，因此 Windows 签名顺序必须是：

```text
rcedit 修改资源
      ↓
签名主 EXE
      ↓
生成 NSIS 安装器
      ↓
签名安装器
```

签名后再次运行 `rcedit` 会使签名失效。Windows QA 必须分别检查主 EXE 和安装器的 Authenticode 状态。

macOS 公开分发至少需要：Developer ID Application、Hardened Runtime、最小必要 entitlements、Apple notarization 和 ticket stapling。签名凭据只能用于受保护的发布环境，不能暴露给外部 PR 或 `pull_request_target` 中的不可信代码。

## 9. 发布质量门禁

迁移采用逐级门禁，不允许跳过前级直接发布：

### G0：上游基线

- 固定上游 Tag 和精确 commit SHA；
- Windows 原版现有检查先跑通并记录结果；
- 平台能力、依赖和风险清单完成。

### G1：平台骨架

- shared/contract 测试在 Windows 与 macOS 都通过；
- shared 模块不能反向导入 `platform/windows` 或 `platform/macos`；
- 不支持能力有明确结果，Renderer 入口行为正确；
- Windows 原有能力无回退。

### G2：功能实现

- 每个上游 diff 项都有自动测试或“必须真机”的书面理由；
- 共享回归双平台通过；
- Windows/macOS 平台测试分别在目标系统通过。

### G3：Electron 运行时

- Renderer smoke 和真实 main-entry smoke 双平台通过；
- 使用一次性隔离 userData，不触碰真实账号、缓存或配置；
- 启动、窗口创建、退出和重启恢复通过。

### G4：安装包

- Windows 原生环境生成并验证 EXE；
- Apple Silicon 原生环境生成 `arm64` DMG；
- 资源清单、安装、首次启动、架构、签名、公证、stapling 和校验和通过。

### G5：RC 真机验收

- 搜索、播放、歌词、本地曲库和设置持久化；
- 快捷键、媒体键、音频设备、多屏、全屏和睡眠恢复；
- Windows 桌面模式以及 macOS 菜单、Dock、Space 和 Gatekeeper；
- 长时运行和性能回归。

### G6：发布完整性与安全

- 上游迁移清单全部关闭；
- EXE、DMG、测试报告和 Tag 来自同一 commit SHA；
- 主 EXE、安装器、`.app` 和 DMG 的签名/公证状态正确；
- 产物内没有 Cookie、Token、用户数据、本机绝对路径或旧构建残留；
- 依赖、安全边界、外部链接/更新入口没有阻塞问题；
- 独立发布完整性与安全 Agent 批准发布。

全部通过后才创建正式 Tag。失败时只创建新的 RC，不移动或重写已经发布的 Tag。

## 10. 首次迁移的建议里程碑

### M0：基线冻结

- 确认最新可信稳定 Tag 和 commit SHA；
- 记录当前 Windows 测试结果；
- 输出平台能力矩阵和风险清单。

### M1：骨架可用

- 平台契约和加载器落地；
- Windows 原有实现接入契约；
- 共享和契约测试通过；
- Windows 行为无回退。

### M2：Mac 最小可运行版本

- Apple Silicon Electron 正常启动；
- 搜索、播放、暂停、切歌、歌词、视觉效果和本地曲库可用；
- Windows-only 入口在 macOS 正确隐藏；
- macOS 菜单、退出和窗口生命周期正确。

### M3：Mac 桌面体验

- 快捷键和媒体键；
- 桌面歌词；
- 文件权限、全屏、多显示器和睡眠恢复；
- 性能和内存检查。
- [ ]  M4：双平台发布

- Windows EXE 和 Apple Silicon DMG；
- 双平台 CI；
- 签名、公证与安装验证；
- 候选版验收后创建正式 Tag 和 Release。

## 11. 对“在一个系统开发、迁移到其他系统”的结论

可以选择一个主要开发系统，并让大部分业务功能只实现一次，但不能只在一个系统验证。

适合一次开发、多平台复用：

- 搜索、播放、歌单、歌词；
- 账号和网络 API；
- Three.js、粒子和普通 UI；
- 共享状态与数据模型。

必须在目标系统实现或验证：

- 窗口层级、全局快捷键、媒体键；
- 桌面歌词、菜单和 Dock；
- 文件和隐私权限；
- Windows 桌面嵌入与 Wallpaper Engine；
- macOS 签名、公证和 DMG；
- 多显示器、休眠恢复和系统音频行为。

最终目标是：每次提交本身就是跨平台提交；平台差异在适配层解决，CI 在合并前发现问题，真机验收保证系统体验。

## 12. 可借鉴项目

思源笔记的实践证明了同一业务主线配合平台构建配置和原生 CI 矩阵是可行的。可重点参考：

- [思源 app/package.json](https://github.com/siyuan-note/siyuan/blob/master/app/package.json)
- [思源 Electron 主进程](https://github.com/siyuan-note/siyuan/blob/master/app/electron/main.js)
- [思源跨平台 CD 构建矩阵](https://github.com/siyuan-note/siyuan/blob/master/.github/workflows/cd.yml)
- [Mineradio v2.1.0 Release](https://github.com/XxHuberrr/Mineradio/releases/tag/v2.1.0)
- [Mineradio package.json](https://github.com/XxHuberrr/Mineradio/blob/main/package.json)
- [Mineradio Windows 完整桌面实现](https://github.com/XxHuberrr/Mineradio/blob/main/desktop/full-desktop-mode-runtime.js)
- [Mineradio Wallpaper Engine 实现](https://github.com/XxHuberrr/Mineradio/blob/main/desktop/wallpaper-engine-runtime.js)
- [Electron 代码签名说明](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [electron-builder 多平台构建](https://www.electron.build/docs/features/multi-platform-build)
- [electron-builder macOS 公证](https://www.electron.build/docs/features/code-signing/notarization)

应借鉴思源的共享主线、平台构建配置和原生 CI，不必照抄其历史目录或在大型主进程文件中继续堆积平台判断。

## 13. 一句话执行原则

> 以最新可信稳定版为基线，先冻结平台契约和测试标准，再由差异审计、共享实现、Windows 实现、macOS 实现、独立审查和构建发布等角色分阶段协作；双平台测试、原生安装包和真机验收全部通过后，才创建正式 Tag。
