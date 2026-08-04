# Windows x64 构建、签名与验证

正式 Windows 构建入口是 `npm run build:win`。该命令不会在缺少 Authenticode 凭据时降级为 unsigned：`build/after-pack.js` 先用 `rcedit` 写入主程序资源，再对主 EXE 签名；NSIS 完成后，`build/windows/after-all-artifact-build.js` 对安装器签名。独立的 internal-beta builder 配置也复用这两个钩子，不会产生仅签主程序、未签安装器的半签名产物。

正式构建需要以下环境变量：

- `WINDOWS_CERTIFICATE_PATH`：本机已有且使用绝对路径表示的 PFX 文件。
- `WINDOWS_CERTIFICATE_PASSWORD`：PFX 密码。
- `WINDOWS_CERTIFICATE_SHA1`：预期发布证书的 40 位 SHA-1 thumbprint；构建会拒绝任何身份不匹配的 PFX。
- `WINDOWS_TIMESTAMP_URL`：可选的无凭据 HTTPS RFC 3161 时间戳地址，默认 `https://timestamp.digicert.com`。

PFX 密码只通过签名子进程的环境传入，不出现在 SignTool 命令行。每次签名会把 PFX 非导出地导入一个随机命名的临时 CurrentUser 证书存储，按受保护 thumbprint 选择证书，并在 `finally` 清除整个临时存储。签名使用 SHA-256 文件摘要与 RFC 3161 SHA-256 时间戳，并在每次签名后执行 `signtool verify /pa /all`。GitHub Actions 还会复核主 EXE 和安装器的实际 signer thumbprint；PFX 文件只写入受保护 `release-signing` environment 的 runner 临时目录，并在构建后删除。

本地只验证 unsigned 布局时，使用：

```powershell
npm run build:win:unsigned
npm run build:win:dir:unsigned
```

显式 unsigned 开关在 CI 中会被拒绝；其输出不能作为发布候选。正式发布还必须在同一候选 SHA 上安装 EXE/NSIS，复验 Authenticode、卸载边界和真实 Windows 行为。
