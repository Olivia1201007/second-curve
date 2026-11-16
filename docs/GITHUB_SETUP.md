# GitHub 公共仓库与发布

## 当前状态

- 仓库：[Olivia1201007/second-curve](https://github.com/Olivia1201007/second-curve)，Public，默认分支 `main`。
- 已提交并推送首次公开源码；质量检查 run `43896426208` 和 v1.0.0 Release run `43896828972` 均成功。
- [v1.0.0 Release](https://github.com/Olivia1201007/second-curve/releases/tag/v1.0.0) 已附上 Android Debug APK、Windows EXE/MSI 与 SHA256 校验文件。
- Android APK 使用标准 Debug 签名，未使用商店发布密钥；Windows 安装包未做代码签名。需要正式签名时，仅使用 GitHub Secrets。

## 工作流

- `.github/workflows/ci.yml`：`main` 推送、PR 或手动触发后运行依赖审计、Lint、格式、类型、测试和 Web 构建。
- `.github/workflows/android.yml`：使用 GitHub-hosted Ubuntu、JDK 和 Android SDK 构建 Debug APK。
- `.github/workflows/release.yml`：推送 `v*` 标签后构建 Android APK 与 Windows 安装包，并将文件和 SHA256 校验文件附加到 GitHub Release。

不要把真实 API 密钥、签名文件、用户简历或个人资料放入源码、工作流日志或公开 Release。未来需要签名时，仅使用 GitHub Secrets。

## Gitee

Gitee 镜像尚未配置。创建并授权镜像仓库后，可运行 `scripts/sync-gitee-mirror.sh <GITEE_REPO_URL>`。不要把访问凭证写入脚本或提交到仓库。
