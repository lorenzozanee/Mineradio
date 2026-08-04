# macOS arm64 构建、签名与公证

## 当前边界

Mineradio 的 macOS 分发目标只有 Apple Silicon (`arm64`) DMG。Windows x64 继续使用 `package.json` 中现有的 electron-builder 配置；macOS 使用根目录的 `electron-builder.macos.js`，不会加载 NSIS、`rcedit` 或其他 Windows 打包步骤。

`npm run build:mac` 是签名和公证的正式构建入口；缺少 Developer ID 或 Apple 公证凭据时会失败，不会自动降级为 unsigned。

## 本地 unsigned 验证构建

本地检查布局时，可以显式关闭 Developer ID 签名和公证：

```bash
npm run build:mac:unsigned
npm run validate:mac:unsigned
npm run test:smoke:macos:package
```

`MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD` 只有精确值 `1` 才生效。未设置时 `forceCodeSigning` 为真，缺少 Developer ID 身份会使构建失败；它不是发布构建的降级路径。

## 签名与公证凭据

正式候选构建需要以下受保护凭据：

- `MACOS_CERTIFICATE_P12`：Developer ID Application 证书及私钥的 base64 编码 PKCS#12。
- `MACOS_CERTIFICATE_PASSWORD`：PKCS#12 密码。
- `APPLE_API_KEY_P8`：App Store Connect Team API 私钥的 base64 编码内容。
- `APPLE_API_KEY_ID`：API Key ID。
- `APPLE_API_ISSUER`：Issuer ID。

工作流只在受保护的 `release-signing` environment 中、通过手动 `workflow_dispatch` 运行签名任务。依赖安装完成后才把 secrets 注入凭据准备或构建步骤；fork PR 只运行不含 secrets 的共享与平台契约测试。工作流把证书导入临时 keychain，把 API 私钥写入 runner 临时目录，并在任务结束时删除两者。

`build/macos/notarize.js` 在 electron-builder 完成应用签名后调用锁文件已有的 `@electron/notarize`。它要求完整的 `APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`，提交已签名 `.app`，等待 Apple 结果并 stapling ticket。任一凭据缺失都会失败。

## 构建与验证

签名环境中的等价构建命令为：

```bash
npm run build:mac
node build/macos/validate-dmg.js dist-macos/Mineradio-2.1.0-macOS-arm64.dmg
```

验证器必须在 Apple Silicon macOS 上运行，并检查：

- DMG 可只读挂载，包含唯一 `.app` 和 `/Applications` 链接。
- 主可执行文件只有 `arm64` slice。
- 包内没有测试、CI、构建脚本、常见本地凭据/日志文件或绝对用户目录路径。
- 应用通过严格 codesign 校验、stapler ticket 校验和 Gatekeeper 执行评估。

`Native package validation` 工作流产物只有 7 天保留期，且不会发布 Release。Windows job 继续调用现有 `npm run build:win`，不改变现有 x64/NSIS 行为。

## 尚需真实凭据和设备验证的发布门

代码检查不能证明 Developer ID 证书有效、Apple 公证服务会接受当前应用、Gatekeeper 会接受互联网下载后的 quarantine 场景，或 DMG 安装后的首启和音频/快捷键/多屏行为正确。正式发布前仍须从同一候选 SHA 完成 Apple Silicon 设备安装与首启、`codesign`、`stapler`、Gatekeeper、签名身份、notary log 和独立 QA 检查；不得把 unsigned 本地产物作为正式候选。

官方依据：

- [Electron code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [electron-builder macOS configuration](https://www.electron.build/electron-builder.interface.macconfiguration)
- [electron-builder hooks](https://www.electron.build/docs/features/hooks/)
- [Apple notarization workflow](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [GitHub-hosted runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
