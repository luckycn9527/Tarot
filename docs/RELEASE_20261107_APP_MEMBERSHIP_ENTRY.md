# 0.1.27 国内 APP 会员兑换入口

日期：2026-11-07。Android `0.1.27 / versionCode 28`，仅国内 `cn.zaopic.etomd`。

## 本轮改动

- 访客、免费用户及已过期会员的会员卡内直接显示醒目的「兑换会员」，权益查看改为次级入口；有效 VIP 的权益及兑换入口保持原有安排。
- 主操作保留同一按钮节点，兑换成功后切换为「查看权益」时可以恢复焦点。沿用既有游客登录续接、兑换 POST 和资料 GET 刷新逻辑，未修改会员权限、期限计算或扣费逻辑。

## 发布

- 最终本地构建、浏览器和 Android 针对性验收已通过，国内 APK 及应用内更新已封存发布：[下载 0.1.27 国内版](https://121.40.27.226:9443/downloads/E-Tomd-0.1.27-domestic-debug.apk)，或在「我的 → 版本更新」升级。
- APK：`E-Tomd-0.1.27-domestic-debug.apk`，`14,335,748` 字节。
- APK SHA256：`ecb8fa5fd22fce66bf7e4dd4b5c65b286769cf47a683794e9be36f6cb4f8362b`。
- 移动 index SHA256：`001f50c3420cf44efab24f86cbc8d50782a5d0f5fb6df76b936daf12c828c6ef`。
- 封存交付目录：`output/app-membership-entry-0.1.27-20261107/`。`verification.json` 标记 `apkSealed: true`，封存时间 `2026-11-07T03:24:58.229Z`；绑定的 `source-snapshot.json` 共 2027 个文件，最终检查匹配。
- 发布 run：`d9fb4267463245b981c4119d2a313a8b`；feed SHA256：`b24e7e7c50e8d98c13d80dc149ba76ae9f05362ee992926db8db54288a92975a`。APK、同名 `.sha256`、版本发行 JSON 和 `android-latest.json` 共 4 个公网文件均返回 200，完整 HTTPS 字节、大小及 SHA 与封存内容一致，原有下载文件未改变。发布及公网核验见交付目录 `publication.json`。

## 已完成验证与边界

- 前端测试 `300/300`、发布器测试 `4/4`、类型检查、国内 Android 构建及静态 APK 检查通过。生产源码在测试、构建和最终验证之间哈希一致；本轮未新增业务测试。
- 首次静态检查沿用了旧前提，要求 `account-benefits-button` 自带 CSS 规则；当前组件将共同样式放在 `account-membership-action`。仅本轮验证脚本改为检查共用样式、非 VIP 兑换及次级权益类，同时保留 VIP 按钮 JavaScript 标记检查。此为校验器适配，不是产品缺陷；原成功测试、构建和失败日志均保留，后续仅重跑静态及发布器检查，未重建 APK。
- 浏览器逐字节绑定最终 APK 的 `216` 个资源文件，`20` 种布局通过：访客、免费次数为 0、免费次数为 3、过期会员及有效 VIP，中英文 `320 × 568` 与 `390 × 844`。非 VIP 唯一直接兑换入口首屏可见且可点击，保留 44px 触摸区，权益和次数可读；VIP 原入口可滚动访问。
- 浏览器 `23` 项流程断言通过，包括访客登录后自动打开兑换、快速双击只发一次 POST、成功后仅一次 profile GET 和一次 quota GET、权益刷新失败时保留成功结果且只重试 GET，以及关闭成功弹窗后在同一按钮节点恢复焦点。另在中英文检查 `18` 组服务端错误场景、共 `98` 项断言；错误保留输入和本地化提示，前端格式错误不发 POST。共留存 `44` 张截图，页面错误、意外 API 和未允许的外部资源尝试均为 `0`；console 中的 4xx/5xx 为刻意模拟的错误响应。
- Android API35 完成 `0.1.26 → 0.1.27` 覆盖安装，`exec-out` 回读装机 APK 的 SHA 与交付包一致，运行时 index 也匹配。实际触摸验证访客点击、取消、登录后自动续接兑换及 Android Back 返回；非 VIP 直接入口、真实 IME 输入固定假码、一次兑换 POST 加 profile/quota 各一次 GET 后显示 365 天成功均通过。关闭后显示 VIP 及 `2027-11-07` 到期日期，同一主按钮 DOM 保留并恢复焦点。
- 浏览器和原生业务均使用本地隔离 fixture 及固定假码，未使用真实 CDK、生产账号或真实 AI，原生 upstream 为 `0`。实际原生键盘与浏览器布局证据分别记录；本轮没有实体手机或系统更新安装全流程验收。
- 原生清理通过：测试应用数据、fixture 私密文件、本轮端口转发及自身 API fixture 已移除或停止，模拟器已退出且本轮端口无监听；网络恢复为测试前的飞行模式 `1`、Wi-Fi `0`、移动数据 `0`，密度恢复。未新建或复制 AVD，保留既有 AVD 用户数据；清理报告与最终原生汇总均通过。
- 本轮另经用户授权，在国内生产环境调用既有已部署的 AdminService 创建 1 个会员兑换码：`vip_days=365`、`maxUses=1`、`usedCount=0`、`expiresAt=null`。仅新增一条兑换码，未兑换、未修改用户资料；真实兑换码内容不写入 Git 文档或公开发布记录。
- 本轮仅国内 APK，不构建或部署网页、后端、iOS 或海外 APK。创建兑换码是上述独立授权的生产操作，不代表部署后端或使用真实兑换码验收界面。

## 证据位置

- 完整构建汇总：`.cache/release-0.1.27-20261107/final-build-summary.json`；静态核验：同目录 `static-verification.json`。
- 原前端及 Android 构建日志、构建前源码快照：同目录 `tools/runs/20261107T031225061Z-fb2227bd/`。
- 适配后的静态核验、发布器检查及最终源码快照：同目录 `tools/runs/20261107T031452037Z-5b07c180-static-resume/`。历史失败摘要保留在原 run，当前汇总的旧视图归档在 `tools/archive/`。
- 最终浏览器：`.cache/release-0.1.27-20261107/qa-redeem/final-report.json`、`final-bundle-proof.json`、`QA-REPORT.md`；截图：`output/playwright/release-0.1.27-20261107/browser-redeem/`。
- 最终原生：`output/playwright/release-0.1.27-20261107/native/summary.json`，装机及运行 index 证据为同目录 `installed-proof.json`、`runtime-index.json`；主入口、真实键盘、成功及焦点证据为 `nonvip-entry.json`、`keyboard-proof.json`、`annual-success.json`、`vip-updated-focus.json`，相关截图位于同目录。
- 原生清理：`output/playwright/release-0.1.27-20261107/native/cleanup.json`；已封存交付与公开发布：`output/app-membership-entry-0.1.27-20261107/verification.json`、`source-snapshot.json`、`publication.json`、`publication-d9fb4267463245b981c4119d2a313a8b.json`。
