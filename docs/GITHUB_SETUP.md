# GitHub 公共仓库与发布

## 当前状态

- 仓库：[Olivia1201007/second-curve](https://github.com/Olivia1201007/second-curve)，Public，默认分支 `main`。
- 已提交并推送首次公开源码；`main` 的质量检查 run `43892149778` 和 Android Debug APK run `43892149864` 均成功。
- v1.0.0 Android/Windows Release 仍待标签工作流完成；只在 GitHub-hosted Actions 成功后提供下载链接，不将本地产物路径冒充为 Release。
- Android Release 工作流生成未签名 Debug APK 与 SHA256 文件；Android 商店签名版本需要将签名材料配置为 GitHub Secrets。

## 工作流

- `.github/workflows/ci.yml`：`main` 推送、PR 或手动触发后运行依赖审计、Lint、格式、类型、测试和 Web 构建。
- `.github/workflows/android.yml`：使用 GitHub-hosted Ubuntu、JDK 和 Android SDK 构建 Debug APK。
- `.github/workflows/release.yml`：推送 `v*` 标签后构建 Android APK 与 Windows 安装包，并将文件和 SHA256 校验文件附加到 GitHub Release。

不要把真实 API 密钥、签名文件、用户简历或个人资料放入源码、工作流日志或公开 Release。未来需要签名时，仅使用 GitHub Secrets。

## Gitee

Gitee 镜像尚未配置。创建并授权镜像仓库后，可运行 `scripts/sync-gitee-mirror.sh <GITEE_REPO_URL>`。不要把访问凭证写入脚本或提交到仓库。
