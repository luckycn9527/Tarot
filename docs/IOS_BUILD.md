# 在 Mac 打包 E-Tomd iOS

当前移动端版本以 `tarot-vue/mobile-version.json` 为准：`0.1.21`，build `22`。iOS 已有 Swift Package Manager（SPM）工程，Capacitor 固定为 `8.5.3`，最低运行系统为 iOS 15。

本次在 Windows 仅完成源码、脚本和静态校验；未进行 Xcode 编译、签名、真机安装或 IPA 验收。`mobile:ios` 负责准备最新原生工程；最终 Run、Archive 和签名在 Mac 的 Xcode 中完成。

## Mac 前提

- Node.js 22 或更新版本（安装后用 `node -v` 检查）。
- 完整 Xcode 26 或更新版本；首次打开 Xcode，接受许可并安装 iOS 平台组件。Xcode 26.0–26.3 支持 macOS 15.6–26.x；其他 Xcode 版本请按 Apple 官方兼容表选择 macOS。
- 在 Xcode → Settings → Locations 的 Command Line Tools 中选择完整 Xcode。若终端仍指向独立 Command Line Tools，可执行 `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`；自定义 Xcode 路径时相应调整。
- 可连接 npm 和 GitHub，以安装依赖并由 Xcode 解析 Swift Package；此工程使用 SPM，无需执行 `pod install`。
- 真机运行需要 Apple ID 和可用签名团队。免费 Personal Team 可用于自己的设备开发测试；Ad Hoc 分发需要有相应资格的 Apple Developer 团队和已登记的设备。

官方参考：[Capacitor iOS 环境](https://capacitorjs.com/docs/getting-started/environment-setup#ios)、[Xcode 系统与 SDK 兼容表](https://developer.apple.com/xcode/system-requirements)、[Apple 真机运行说明](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device)。

## 获取源码并准备工程

仓库：[luckycn9527/Tarot](https://github.com/luckycn9527/Tarot)，本次交付分支为 `main`。已有仓库时，在仓库目录执行：

```sh
git switch main
git pull --ff-only origin main
```

首次获取时执行 `git clone https://github.com/luckycn9527/Tarot.git`，然后 `cd Tarot`。在仓库目录继续执行：

```sh
cd tarot-vue
npm ci
npm run mobile:ios -- --site=domestic --open
```

默认站点为 `domestic`；需要海外站时改为 `--site=overseas`。两者共享当前 iOS Bundle Identifier 和安装身份，依次打包会替换同一 App 中的站点资源。它们不是两个可同时安装的 iOS 应用；如确需并存，需要另行规划 Bundle ID 和分发配置。

该命令依次导出已确认的 iOS 图标、执行当前 `mobile-build.mjs`（TypeScript 检查和移动网页构建）、`cap sync ios`、同步 Debug/Release 的 Version 与 Build，并核验同步后的网页版本及 index 哈希。`--open` 最后打开 `ios/App/App.xcodeproj`。成功提示 `iosPreparation: passed` 仅表示工程准备完成，不表示原生编译或签名成功。

iOS 图标已从确认过的星门符号母版导出。需要重新导出时，在 `tarot-vue` 运行 `npm run mobile:icons:ios`；它仅更新 iOS 的 1024px AppIcon。

国内站当前 API 地址来自 `mobile-build.mjs`：`https://121.40.27.226:9443`；海外站为 `https://asktarot.zaopic.cn`。网页资源打包进 App，API 和账号功能仍需要联网。移动构建关闭支付入口。不要添加 `server.url` 或关闭 TLS 校验；若真机遇到证书错误，应检查服务证书信任链和域名/IP 匹配。

每次改源码或切换站点后重新执行此命令。`dist-mobile`、`ios/App/App/public`、生成的 `capacitor.config.json` / `config.xml` 都由构建和 sync 重新生成，不以旧缓存代替当前构建，也不提交到 Git。

跨平台只想检查静态准备条件时：

```sh
npm run mobile:ios -- --site=domestic --check
```

`--check` 只读源码并输出执行计划，不写文件，不运行网页构建、Capacitor sync、Xcode 或签名检查；Windows 默认执行真实准备命令会立即拒绝。它不能证明 Mac 工具链或 iOS 原生构建可用。

## 在 Xcode 安装到自己的 iPhone

1. 打开 `tarot-vue/ios/App/App.xcodeproj`，等待 Swift Package 解析完成。选择项目中的 **App target**，进入 **Signing & Capabilities**。
2. 启用 **Automatically manage signing**，选择你的 **Team**。仓库不包含 Team ID、证书或描述文件。
3. 默认 **Bundle Identifier** 为 `cn.zaopic.etomd`。使用有权限的团队时可保留；如果 Xcode 提示该标识不可用，为自己的测试选择唯一标识。将改动保留在本机；若要正式替换项目标识，还需同步 `capacitor.config.ts` 的 `appId` 并重新核验相关服务配置。
4. 在 General 中检查 Version `0.1.21`、Build `22`（以后以 `mobile-version.json` 为准）及 iOS 15 deployment target。
5. 连接并信任 iPhone，在手机中按提示启用 **Developer Mode**；在 Xcode 顶部选择该设备，点击 **Run**。模拟器也可以做界面初检，但不能代替真机验证。
6. 安装后验证启动、国内/海外目标站点、登录、退出重启后的会话状态、头像选择/取消/上传、会员兑换与权益、生辰、主要占卜和历史流程。真实占卜和兑换可能消耗额度或改变账号数据，应使用你允许的测试账号及测试兑换码。

头像目前通过网页文件选择器选择图片。`Info.plist` 已补充相机与照片选择的用途说明，供系统选择器出现相关入口时使用；没有新增相机插件或保存到相册功能。现有 Capacitor 原生依赖自带隐私清单；本次没有做 App Store 隐私申报或 Archive 隐私报告验收，发布前需结合实际数据收集行为核对。

## Archive 与 Ad Hoc 导出

1. 使用具备分发权限的 Apple Developer Team，并确认需要安装的设备 UDID 已登记。参见 [Apple Ad Hoc 描述文件要求](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile/)。
2. 选择 **Any iOS Device (arm64)** 或相应通用 iOS 真机目标，执行 **Product → Archive**。
3. Organizer 中选择刚产生的归档，执行 **Distribute App**，按当前 Xcode 提供的 **Ad Hoc / Release Testing（登记设备测试）** 路径导出；菜单名称会随 Xcode 版本变化。选择正确的团队、证书和包含目标设备的描述文件。
4. 导出后再把 IPA 安装到已登记设备，并重复关键流程。Personal Team 的本机 Run 成功不代表能够完成 Ad Hoc 导出。

需要发布后续构建时先更新 `mobile-version.json` 的 version / versionCode，再重新准备和 Archive；脚本会同步 iOS 原生版本。此流程不自动上传 App Store Connect、不生成或分享证书，也不改线上服务。
