# 0.1.25 国内 APP 头像资料合并与失联追问恢复

日期：2026-11-06。Android `0.1.25 / versionCode 26`，仅国内 `cn.zaopic.etomd`。

## 本轮改动

1. **头像上传保留最新资料**：旧上传响应会返回完整 User，其中次数、会员、昵称和生辰可能早于上传期间已完成的资料刷新。现在要求服务器明确确认成功、账号和会话范围一致、头像值合法，只将响应中的 avatar 合并到当前资料，再持久化；旧完整响应不能回退其他字段，切换账号后的旧响应不能覆盖新账号。
2. **原记录不存在时结束本机等待**：原记录 404、追问请求 GET 也未确认且不在提交/轮询中时，用户可主动确认「结束本机等待」。操作再次 GET 原 requestId；如已接收，则保留并按服务器真实状态处理。只有再次 404 才先保存带 `recovery=record-missing` 的原任务、原追问和说明，并回读确认，再删除当前账号对应的 pending，直接核验底层存储已移除。保存或读取失败、请求或账号变化时不冒充完成。恢复后可开始新问卜，原追问仍可查看，其他草稿保留。

恢复操作只改变本机未确认的等待状态，不重新 POST 追问，不取消或更改服务端处理结果，不退还或增加次数，也不自动重新发送原文。已经正常运行的任务不能借此清除。

## 发布

- 最终构建、自动测试及静态核验已通过；头像最终移动资源的浏览器 4 组及 Android API35 的最终正式包验收通过。
- 原记录不存在的追问浏览器完成 5 项流程，另有独立英文 320px 布局检查。封存时磁盘报告仍为 `status=partial, passed=5` 和 3 项待补，canonical verification 保留该时点，不能改成同一时点全部完成。英文布局实际已通过，其报告稍后归档为独立补充；跨账号与普通 pending 的两项独立 UI 验收未完成。
- 国内 APK 及应用内更新已封存发布：[下载 0.1.25 国内版](https://121.40.27.226:9443/downloads/E-Tomd-0.1.25-domestic-debug.apk)，或在「我的 → 版本更新」升级。APK、APK 校验文件、版本元数据及 `android-latest.json` 共 4 个公网文件均返回 200，完整 HTTPS 字节及 SHA 与封存内容一致，原有下载文件未改变。
- 发布 run：`84839a5c9516461abf164c9ab994e4b1`；feed SHA256：`c998b599fe354d372b9118694a1e3b75cd21a85f86a61a95bc87410cb5fb8880`。前一 feed 的回滚指纹仍保留在本次发布回执中。
- 正式 APK 大小：`14,323,345` 字节；SHA256：`71a1c25b043429c40c8a4be3be5033049ab19cdda4279e49bb5cc03e95d07f10`。
- 移动 index SHA256：`580fb2ad6f87815babce1eb4a89b8ab525bbceb42b0c07ccc83da51ca640d4df`。
- 交付目录：`output/app-recovery-0.1.25-20261106/`，包含已标记 `apkSealed: true` 的 `verification.json`、绑定的 `source-snapshot.json`、原生实际验收及公开发布回执。独立晚归档布局补充不修改该原始封存。

## 已完成验证与边界

- 最终前端自动测试 `300/300` 通过，其中新增头像合并 6 项、任务恢复 13 项；4 项发布器测试、`vue-tsc`、完整国内构建及静态包检查通过。
- 头像的最终资源浏览器验证已完成 4 组：上传等待期间先接受新配额、会员、昵称和生辰，再返回旧头像响应，最新资料保留且追问正常；未确认成功或非法头像地址时保留资料与所选图片；跨账号迟到响应不恢复旧账号。已查看 6 张截图。
- 失联追问浏览器完成的 5 项流程分别为：取消确认保留 pending、二次 GET 返回 running 时保留正常跟踪、底层删除抛错/静默不删除时保留并可重试、结束后保留原文且可进入新选牌，以及不能结束另一条记录的追问。独立英文 320px 截图另经检查，无横向溢出；其晚归档报告作为封存之后的补充，不回写原 verification。
- 跨账号的浏览器场景未完成有效验收：原脚本错误地要求退出后保留旧账号 pending，与已有退出清理语义冲突，未将其算作产品缺陷，也未宣称该 UI 场景通过。owner、迟到响应和活跃请求保护由本轮 13 项恢复模型回归覆盖。普通 pending 的独立浏览器场景未执行，正常新问卜与追问完成流程由下述实际 Android 验证覆盖；这些证据层次分别记录。
- Android API35 最终正式包覆盖安装及装机 SHA 回读一致。冷启动恢复原记录不存在的追问后，取消确认保持原 pending，确认结束则物理移除 pending 并保留原追问、登录和账号 72 的 sentinel。随后真实触摸完成新问卜→选牌/翻牌→模拟生成记录 1001→原牌追问→历史重新打开，问题、牌 ID62 及逆位方向和新追问均保留。
- 已检查 3 张原生截图，未见横向溢出；原生业务请求全部由本地模拟响应，upstream、blocked、unexpected 均为 0。只有明确新建的 2 个模拟任务完成，没有退款。测试数据与自身代理/端口已清理，网络恢复到测试前状态，模拟器已关闭，未新建 AVD。测试启动环境调整不作为产品修复。
- 浏览器专用会话和本轮本地预览服务已关闭；失联追问的独立清理报告通过，不将未执行的两项 UI 场景随清理结果记为通过。
- 本轮没有改 Java，也没有重新运行 Java/JVM 测试；此前批次的 Java、缓存或原生更新结果不算本轮重测。
- 本轮不构建或部署网页，不改后端、PM2、Nginx、数据库或服务器环境；iOS 工程不变，也不进行 iOS 构建或真机验收。不新增海外 APK。
- 业务验收使用本地隔离测试接口，不把模拟响应描述为生产反馈、邮件或真实 AI 验收；本轮范围以实际原生及浏览器报告为准。

## 证据位置

- 最终构建与测试汇总：`.cache/release-0.1.25-20261106/final-build-summary.json`、`tests-final.log`、`publisher-tests-final.log`、`static-verification.json`。
- 头像浏览器实际报告：`.cache/release-0.1.25-20261106/qa-avatar/QA-REPORT.md`、`browser-reports.json`。
- 失联追问浏览器实际部分结果：`.cache/release-0.1.25-20261106/qa-orphan/report.json`。
- 浏览器收尾：`.cache/release-0.1.25-20261106/qa-orphan/cleanup.json`。
- 独立英文布局及晚归档的最终浏览器说明：交付目录 `supplemental-layout/browser-orphan-final.json`（最终 `partial`，5 项流程加 1 项独立布局，2 项 UI 未完成）；补充报告不改变原封存时点的 5 项流程记录。
- 最终移动资源浏览器与 Android 测试：`output/playwright/release-0.1.25-20261106/browser-avatar/`、`browser-orphan/`、`native/`。各目录按其报告记录实际范围，不以目录存在宣称全部计划场景通过。
- 原生安装及行为：同目录 `native/installed-proof.json`、`orphan-cancel-native.json`、`orphan-ended-native.json`、`new-reading-native.json`、`followup-native.json`、`history-open-native.json`；清理：`.cache/release-0.1.25-20261106/cleanup-native.json`。
- 交付的原始封存及源码：`output/app-recovery-0.1.25-20261106/verification.json`、`source-snapshot.json`；封存时浏览器流程报告：同目录 `browser-orphan.json`（5 项流程）。原生汇总：同目录 `native-acceptance.json`，公开发布：`publication.json`、`publication-84839a5c9516461abf164c9ab994e4b1.json`。

0.1.24 及更早版本的下载、封存、网页部署及验收记录继续保留，不重复计作本轮验证。
