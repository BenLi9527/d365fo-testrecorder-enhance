# D365 F&O Task Recorder Enhance

一个独立的浏览器扩展(Manifest V3, Edge/Chrome 通用),用于增强 Dynamics 365 Finance & Operations
的 **Task Recorder** 截图能力。核心思路来自对 D365 F&O 客户端截图钩子的分析,并用全新代码重新实现:

> D365 F&O Task Recorder 在录制每一步操作时,会在页面 `document` 上派发一个自定义事件 `"screenshot"`。
> 本插件监听该事件,委托浏览器扩展的 `chrome.tabs.captureVisibleTab` API 截取当前可见标签页画面,
> 并统一管理截图历史、剪贴板复制与批量下载。

## 功能
- **握手标记**:向页面注入隐藏元素 `<div id="screenshotExtensionIsInstalled">`,让 D365 F&O Task Recorder 探测到"截图扩展已安装",从而在录制弹窗里显示/启用 "Capture screenshots" 选项并派发截图事件(SPA 局部刷新时用 MutationObserver 自动补插)
- **自动截图**:监听 D365 F&O 页面的 `screenshot` 事件,Task Recorder 录制每一步时自动截图(可在弹窗开关),并通过 `window.postMessage` 把截图回传给页面供 D365 F&O 自身内嵌使用
- **隐藏控制类界面**:截图前自动临时隐藏本插件的悬浮按钮/Toast,并尽力探测隐藏 D365 F&O 原生 Task Recorder 录制面板(启发式选择器,微软未公开确切 DOM 结构,不保证 100% 命中),截图完成后立即恢复显示
- **手动截图**:页面右下角悬浮按钮 📷,或快捷键(默认 `Ctrl+Shift+Y`,可在弹窗内点击"修改"跳转系统设置页自定义),随时手动截图
- **限速重试**:`captureVisibleTab` 官方限速约 2 次/秒,内置节流队列 + 指数退避重试,避免 `MAX_CAPTURE_VISIBLE_TAB` 报错丢图
- **历史记录**:截图缩略图列表,展示触发方式(Task Recorder / 手动)与时间戳,上限可在弹窗中配置(默认 30 张)
- **一键复制**:通过离屏文档(offscreen document)把截图 PNG 写入系统剪贴板,可直接粘贴到 Word/Azure DevOps/Teams
- **批量/单张下载**:导出到 `下载/D365TaskRecorder/` 文件夹,文件名自动包含菜单项与时间戳
- **页面 Toast 提示**:截图成功/失败时页面右下角浮层提示,不打断操作

## 文件结构
| 文件 | 作用 |
|---|---|
| `manifest.json` | 扩展配置(权限、内容脚本、快捷键) |
| `content.js` | 注入 D365 F&O 页面:监听 `screenshot` 事件、悬浮按钮、Toast 提示 |
| `background.js` | 后台 Service Worker:截图节流重试、历史记录管理、下载/复制路由 |
| `offscreen.html/js` | 离屏文档:执行剪贴板写入(Service Worker 无 DOM 权限) |
| `popup.html/js` | 弹窗界面:开关、历史列表、复制/下载/清空 |
| `icons/` | 扩展图标 (16/48/128) |

## 安装测试
1. Edge 地址栏输入 `edge://extensions/`,开启"开发人员模式"
2. "加载解压缩的扩展" → 选择 `D365-TaskRecorder-Enhance` 文件夹
3. 打开 D365 F&O 环境,启动 Task Recorder 开始录制,每完成一步会自动截图
4. 点击工具栏插件图标查看截图历史、复制或下载

## 注意事项
- `host_permissions` 目前已放开为 `<all_urls>`(不再限定 D365 F&O 常见域名),以避免不同租户域名不匹配导致截图失败
- 历史记录以 Base64 存储在 `chrome.storage.local`,上限默认 30 张(可在弹窗中调整),超出自动清理最旧的记录,避免占用配额;如需长期保存,请及时下载导出
- 若 D365 F&O 页面本身未派发 `screenshot` 自定义事件(不同版本/自定义环境可能行为不同),可改用手动截图按钮或快捷键