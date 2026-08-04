# Windows x64 构建、签名与验证

正式 Windows 构建入口是 `npm run build:win`。该命令不会在缺少 Authenticode 凭据时降级为 unsigned：`build/after-pack.js` 先用 `rcedit` 写入主程序资源，再对主 EXE 签名；NSIS 完成后，`build/windows/after-all-artifact-build.js` 对安装器签名。独立的 internal-beta builder 配置也复用这两个钩子，不会产生仅签主程序、未签安装器的半签名产物。

正式构建需要以下环境变量：

- `WINDOWS_CERTIFICATE_PATH`：本机已有且使用绝对路径表示的 PFX 文件。
- `WINDOWS_CERTIFICATE_PASSWORD`：PFX 密码。
- `WINDOWS_TIMESTAMP_URL`：可选的无凭据 HTTPS RFC 3161 时间戳地址，默认 `https://timestamp.digicert.com`。

签名使用 SHA-256 文件摘要与 RFC 3161 SHA-256 时间戳，并在每次签名后执行 `signtool verify /pa /all`。GitHub Actions 只在受保护的 `release-signing` environment 内将 Base64 PFX 写入 runner 临时目录，并在构建后删除。

本地只验证 unsigned 布局时，使用：

```powershell
npm run build:win:unsigned
npm run build:win:dir:unsigned
```

显式 unsigned 开关在 CI 中会被拒绝；其输出不能作为发布候选。正式发布还必须在同一候选 SHA 上安装 EXE/NSIS，复验 Authenticode、卸载边界和真实 Windows 行为。
