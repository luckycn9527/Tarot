# 0.1.26 国内 APP 每日暗纹与问卜操作层级

日期：2026-11-07。Android `0.1.26 / versionCode 27`，仅国内 `cn.zaopic.etomd`。

## 本轮改动

1. **每日页暗纹背景**：增加深墨色、低对比的天体轨道暗纹，仅作用于每日页背景。保持现有紫色牌背、真实牌面、文字、布局和交互。原图由内置 image_gen 生成，缩放并编码为 `768 × 1664` WebP，`10,886` 字节；素材 SHA256 为 `2c9301dc9c1b0a59e24c8cb48de5284e79e86811c251d965937e02f14c03d7f9`，来源及处理记录见 `output/app-daily-atmosphere-20261106/generation.json`。
2. **问卜操作层级**：问题页底部保留唯一主操作「开始抽牌」；已有翻开牌组时为「解读原牌」。首屏、短屏和键盘展开时均可见、可点击，保留原表单提交、完整错误提示和输入。页头「新问卜」采用透明次级按钮并保留触摸区域；末项塔罗师字段可以滚动到操作栏上方。问题操作栏不进入选牌、解读、追问或历史页面。

## 发布

- 最终构建、自动测试、浏览器及 Android API35 验收已完成，国内 APK 及应用内更新已封存发布：[下载 0.1.26 国内版](https://121.40.27.226:9443/downloads/E-Tomd-0.1.26-domestic-debug.apk)，或在「我的 → 版本更新」升级。
- 国内 APK：`E-Tomd-0.1.26-domestic-debug.apk`，`14,413,545` 字节。
- APK SHA256：`f0906508419d35ab94a502c3dd0045adb257562badf2b28c48f19dacfa0f02cd`。
- 移动 index SHA256：`e4b73343e083807cd27b537fd196c4339f1afe646db814ca30654037664dc247`。
- 最终构建 run：`20261107T025004643Z-aab6ae2c`；本地构建目录：`.cache/mobile-20261028/artifacts/0.1.26/domestic/`。封存交付目录：`output/app-ui-0.1.26-20261107/`，`verification.json` 标记 `apkSealed: true`，封存时间为 `2026-11-07T03:01:37.706Z`；绑定的 `source-snapshot.json` 共 2027 个文件，封存及最终检查均匹配。
- 发布 run：`78f4479d288849e5bfb9f9e49f70b72d`；feed SHA256：`967533479f72ad8a548ea4c80e01f53b7645919872ec91a14229a132e51b25a6`。APK、同名 `.sha256`、版本发行 JSON 和 `android-latest.json` 共 4 个公网文件均返回 200，HTTPS 完整字节、大小及 SHA 与封存内容一致，原有下载文件未改变。发布与公网校验见交付目录 `publication.json` 和 `publication-78f4479d288849e5bfb9f9e49f70b72d.json`。
- 11 月 6 日的旧 `0.1.26` 候选未封存、未发布，旧 QA 记录保留；其 APK 指纹不代表本次最终候选。已发布的 `0.1.25` 和更早下载、封存及发布记录继续保留。

## 已完成验证与边界

- 最终前端测试 `300/300`、发布器测试 `4/4`、`vue-tsc`、完整国内 Android 构建及 APK 静态检查通过。构建前后源码快照相同；签名、包名、版本、国内 API、离线资源和移动 index 绑定通过。
- 最终包浏览器验收逐字节绑定 APK 内的 `216` 个公开资源文件。中文和英文的 `320 × 760`、`360 × 800`、`390 × 844`、`320 × 568` 共 `26` 种布局通过：主操作首屏可见并能接收点击、仅一个主操作、次级按钮触摸区域、末项字段滚动、空白或非法问题的完整提示及输入保留。
- 浏览器另完成 `13` 项实际流程断言及 `26` 项恢复、错误与背景范围检查，共 `39` 项：三牌选择与整组锁定、新问卜、精确恢复牌 ID/方向/翻开状态、登录续接、解读和追问提交、历史重开；部分翻牌继续、pending 的原请求编号与载荷保留且只提交一次、pending 期间禁用问题操作、恢复面板展开、塔罗师资料加载失败可读及每日背景范围均通过。
- 浏览器保存 `41` 张截图，并抽查正常和短屏、末项塔罗师、英文错误、恢复面板、资料错误、锁定三牌、历史结果和每日背景。页面错误、意外 API 及未允许的外部资源尝试均为 `0`；唯一 `503` console 错误来自刻意模拟的资料加载失败。
- Android API35 最终正式包覆盖安装及装机 APK 回读通过，版本、字节数和 SHA 与上述候选一致。使用实际触摸和原生键盘验证：空问题与错误提示下主操作可见，键盘展开后主操作仍可点击；进入选牌后问题操作栏消失；翻牌后返回保留原问题、牌 `ID 66` 及正位，并显示「解读原牌」；登录后续接解读、原牌追问、历史重新打开和主动新问卜通过。相应页面未见横向溢出。
- 浏览器使用真实 Chromium，Android 使用 API35 模拟器及原生键盘。两者的业务 API、解读和追问响应均由本地隔离 fixture 提供，不代表生产接口、真实 AI、扣费业务或实体手机验收；本轮未重跑系统更新安装全流程。浏览器同步确认桩已安装，但本轮流程未触发；不将浏览器视口模拟记为原生键盘或系统对话框验收。
- 原生最终包的每日背景已查看并留存 `daily-final-native.png`。原生验收结束后已清理测试数据、移除本轮端口转发、停止自身 fixture、恢复原网络状态并关闭模拟器，未新建 AVD；汇总见交付目录 `native-acceptance.json`。一次过期 toast 的等待超时保留为测试限制，后续解读、追问和历史的持久结果断言均通过。
- 本轮只交付国内 APK，不构建或部署网页，不改后端、PM2、Nginx、数据库或服务器环境，不构建 iOS 或海外 APK。未修改 Java，也未将此前 Java/JVM 测试记作本轮重测。

## 证据位置

- 构建、测试及静态核验：`.cache/release-0.1.26-20261107/final-build-summary.json`、`static-verification.json`，逐次原始日志与源码快照在同目录 `tools/runs/20261107T025004643Z-aab6ae2c/`。
- 最终浏览器报告：`.cache/release-0.1.26-20261107/qa-ask/QA-REPORT.md`、`final-report.json`、`final-bundle-proof.json`；截图在 `output/playwright/release-0.1.26-20261107/browser-ask/`。
- 原生安装与装机字节：`output/playwright/release-0.1.26-20261107/native/installed-proof.json`。
- 原生问题页及键盘：同目录 `ask-empty-dock.json`、`ask-error-keyboard.json`、`ask-filled-keyboard.json`、`ask-keyboard-settled.json`；原牌保留：`ask-lock-before.json`、`ask-lock-question.json`、`ask-lock-dock.json`；新问卜和选牌：`ask-new-secondary.json`、`ask-started-select.json`。
- 原生解读、追问和历史：同目录 `reading-core.json`、`followup-core.json`、`history-core.json`。fixture 私密文件不作为公开交付说明。
- 最终原生验收汇总：`output/app-ui-0.1.26-20261107/native-acceptance.json`；最终每日截图：`output/playwright/release-0.1.26-20261107/native/daily-final-native.png`。11 月 6 日的设计前后比较只作历史依据，不代替最终包的截图或验收。
- 每日暗纹生成依据：`output/app-daily-atmosphere-20261106/generation.json`；移动资源为 `tarot-vue/src/assets/mobile/daily-celestial-ink-v1.webp`。
- 已封存交付与发布：`output/app-ui-0.1.26-20261107/verification.json`、`source-snapshot.json`、`browser-acceptance.json`、`browser-binding.json`、`native-acceptance.json`、`publication.json`。
