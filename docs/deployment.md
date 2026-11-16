# 发布与部署

## Web

当前公开体验链接继续由 Sites 托管。配置在 `.openai/hosting.json`；更新后静态构建 `out/` 并经 Sites 保存版本/部署流程发布。未完成 ICP 备案和大陆网络实测前，不承诺全国稳定直连。

## GitHub

仓库主分支 `main` 触发质量检查和 Web 构建；标签 `v*` 触发 Android debug APK、Windows 安装包和 SHA-256 文件构建并创建 Release。Release 工作流未配置 Android 发行签名，因此 Android artifact 明确为 Debug 体验版。正式签名需要通过 GitHub Secrets 配置签名文件与密码，不能将 keystore 提交到仓库。

## Gitee 镜像

运行 `scripts/sync-gitee-mirror.sh <gitee-url>` 前需在本机完成 Gitee 身份验证与创建空仓库。该脚本不会创建 Gitee 账号或仓库，也不会声称镜像已同步。
