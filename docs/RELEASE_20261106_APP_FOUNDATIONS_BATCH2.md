# 0.1.24 国内 APP 帮助、存储与密码找回衔接

日期：2026-11-06。Android `0.1.24 / versionCode 25`，仅国内 `cn.zaopic.etomd`。

## 本轮功能

1. **帮助与反馈**：个人中心可在 APP 内查看六项常见问题、填写并保存反馈。离线不提交；失败、关闭及重新打开后保留未确认草稿，由用户手动重试。只有服务器明确返回成功才显示送达。诊断信息默认关闭，用户主动同意后只附加白名单内容，并遵守总长度限制；迟到的旧提交结果不覆盖新表单。
2. **存储与本机数据**：显示原生更新缓存的实际字节及文件数，确认后只清理固定更新文件。检查、下载、校验、安装或清理占用期间禁止并发清理；未知占用不显示为零，失败不破坏已就绪的更新状态，实际释放为零时准确说明。普通缓存清理保留登录和问卜草稿；退出或注销时物理清除当前账号的 15 类私有键，包括原始 JSON null 和损坏数据，保护其他账号、游客及全局偏好。
3. **密码找回返回 APP**：网页重置成功后保持成功页，由安卓用户主动点击返回 APP；使用固定、无参数的返回地址，不携带重置 token 或密码。APP 只消费本次有效邮箱提示，预填邮箱、保持密码为空，不自动登录。支持冷启动、热启动、手动返回和新一轮找回；重复返回不覆盖正在输入的邮箱或密码，不强制退出已登录的其他账号。

## 发布状态

- 国内网页已发布：`https://121.40.27.226:9443`。公开 HTTPS 已完整核验首页及 `web-release.json` 字节。
- 网页 index SHA256：`2ee21272a8489a9fbc6610e55207b3576cec87f3709069626e91e4287479b8b7`。
- 网页发布 run：`20261106-web-0.1.24-a932f081b294`；保留 61 个原有下载文件及 918 个旧 assets 文件。
- 网页回退目录：`/var/www/tarot.zaopic.cn/dist.pre-20261106-web-0.1.24-a932f081b294`。较晚回退前须保留届时的 downloads/feed，不能用旧备份撤回后续 APK 更新。
- 国内 APK 已封存发布：[下载 0.1.24 国内版](https://121.40.27.226:9443/downloads/E-Tomd-0.1.24-domestic-debug.apk)，或在「我的 → 版本更新」升级。
- 应用内更新 feed 为 `0.1.24 / code25`。APK、APK 校验文件、版本元数据和 `android-latest.json` 共 4 个公网文件均返回 200，完整 HTTPS 字节与封存 hash 一致；既有下载文件未改变。
- APK 发布 run：`8a5c363bc5d64646ba0bf1ee7e51bdae`；feed SHA256：`ed057a8c300d4d116f5cdc0a5b2cf42fe9cd6e6740cf3e7d7ba064dbd7b87362`。前一 feed 保留在该次发布回执对应的回滚记录中，旧版 APK 继续保留。
- 最终 APK 大小：`14,400,040` 字节；SHA256：`9788f861586497974279e9cad9e5c6fa6020fda7ff498dc693b7f25b42b1d9f8`。
- 交付目录：`output/app-foundations-0.1.24-20261106/`；`verification.json` 已标记 `apkSealed: true`，并绑定 `source-snapshot.json` 和实际 QA。APK 公开发布证据为同目录 `publication.json`。

## 验证与边界

- 281 项前端测试、4 项发布器测试、类型检查及国内网页/Android 构建通过。原生 JVM 6 项通过、1 项 Windows 符号链接测试跳过；对应的 `getStorageInfo` 与 `clearUpdateCache` 不安全路径拒绝已在 Android API35 的真实符号链接上补证。
- 浏览器使用与最终 APK 逐文件一致的移动资源，完成帮助与反馈 6 组、退出清理及手动找回返回 2 组、单独的账号注销集成 1 组；网页重置密码完成 4 组。覆盖失败保留、关闭重开、明确成功、迟到响应、新旧账号隔离及中英文小屏布局。
- DEV 存储面板另完成 9 组桥接模拟，验证实际范围文案、未知占用、忙碌禁用、失败状态隔离、释放字节、确认前文件消失和登录/草稿保留；这些模拟不等同原生文件系统验收。
- 正式 APK 在 Android API35 覆盖安装，回读已安装 `base.apk` 的 SHA256 与上述正式包一致。真实 Android 操作覆盖反馈失败→返回→重新打开→成功、账号 71 的 15 类数据物理清理且保护账号 72/游客/全局数据，以及密码找回的冷启动、热启动、同 URI 新一轮请求、重复返回输入保护和已登录账号 72 不被强退。
- 同原生插件源码的独立 `updaterQa` 客户端以 code24 实际下载并校验正式签名 code25 目标，验证忙碌时拒绝清理、真实缓存字节/文件计数、清理后取消旧安装就绪状态、SecureStorage 和非目标文件保留，以及真实符号链接拒绝。未知普通文件不计入也不删除。该隔离更新链不代表已经通过公开更新源安装新版。
- 帮助/反馈、登录、找回和重置的业务接口均使用隔离测试响应；未发送真实 SMTP 邮件、未提交生产反馈、未调用真实 AI，未对生产账号执行修改或注销。
- 本轮未修改后端、PM2、Nginx、数据库、服务器环境或 `APP_PUBLIC_ORIGIN`。已只读确认运行中的国内 PM2 邮件公共 origin 原已正确指向 `https://121.40.27.226:9443`，没有将其算作本轮修复。
- iOS 工程未修改或升级至 0.1.24；未进行 iOS 构建、iPhone 或安卓实体手机验收，未发布海外网页或新增海外 APK。测试复用既有 AVD；自身测试数据、代理、端口和模拟器已清理，未新建 AVD。

## 证据位置

- 最终构建及测试汇总：`.cache/release-0.1.24-20261106/final-build-summary.json`、`tests-final.log`、`publisher-tests-final.log`、`native-unit.log`。
- 最终 APK 帮助、反馈、退出及注销浏览器流程：`.cache/release-0.1.24-20261106/qa-support/QA-REPORT.md`、`browser-reports.json`、`delete-run.json`；截图在 `output/playwright/release-0.1.24-20261106/browser-support/`。
- 网页重置：`.cache/release-0.1.24-20261106/qa-reset/report.json`；DEV 存储面板：`.cache/release-0.1.24-20261106/qa-storage/report.json`。
- 正式安装与原生行为：`output/playwright/release-0.1.24-20261106/native/installed-proof.json`、`account-logout-native.json`、`password-*-native.json`、`cache-native.json`、`cache-other-native.json`、`cache-symlink-native.json`；测试清理：`.cache/release-0.1.24-20261106/cleanup-native.json`。
- 最终封存与源码：`output/app-foundations-0.1.24-20261106/verification.json`、`source-snapshot.json`；正式 Android 汇总：同目录 `native-acceptance.json`。
- 网页实际发布：`.cache/release-0.1.24-20261106/qa-deploy/20261106-web-0.1.24-a932f081b294/publication.json`；APK 公开发布：`output/app-foundations-0.1.24-20261106/publication.json` 和 `publication-8a5c363bc5d64646ba0bf1ee7e51bdae.json`。

此前的 0.1.23 及更早封存、下载和验收记录继续保留；旧版结果不冒充本轮重新执行的测试。
