# 第二曲线 AI 4.1.1：安卓顶栏与个人中心返回修复

手机端顶部按钮已下移并增加留白，个人中心左上角新增“← 返回”。返回按钮和 Android 系统返回键会回到进入个人中心前的页面，保留已经填写的内容。

- Android 15 及以上按状态栏、屏幕缺口和导航栏 Insets 自动避让；浅色界面使用深色状态栏图标。
- 手机顶栏从 62px 调整为 78px，顶部按钮点击高度至少 44px。
- 版本 4.1.1，versionCode 6，包名 com.secondcurve.app。

## 下载与更新

- 安卓安装包：`second-curve-4.1.1-android-debug.apk`
- 对应完整仓库源码：`second-curve-4.1.1-source.zip`
- 改动补丁：`source-changes.patch`
- 校验值：`SHA256SUMS.txt`

本次 APK 沿用 4.1.0 预览测试包的签名，可以覆盖该测试版并保留本机资料与模型设置。请直接安装；若设备提示签名冲突，请先保留原应用，核对原安装包来源。

本次发布安卓更新。Windows 安装包继续使用 [4.1.0 预览版](https://github.com/Olivia1201007/second-curve/releases/tag/native-cloud-v4.1.0-preview.1)。

## 验证

ESLint 零警告、TypeScript、Prettier、Next.js 生产构建、16 项现有测试及 12 项 Chromium 布局与返回操作检查均通过。Android assembleDebug 构建成功；APK 签名、版本和包内安全区配置已核验。

附图为手机尺寸浏览器预览，不含 Android 系统状态栏。尚未完成 Android 真机安装与系统栏效果验收。本包为 Debug 预览测试包。
