# D365 F&O Task Recorder Enhance — User Guide

Version: 1.0.114
Supported browsers: Microsoft Edge / Google Chrome (Chromium-based, Manifest V3)

## 1. What is this extension

Dynamics 365 Finance & Operations (D365 F&O)'s built-in **Task Recorder** can record process steps
and generate a step-by-step document with screenshots, but it requires a browser "screenshot
extension" to be installed to enable automatic capture. This extension is an enhanced implementation
of that screenshot extension. In addition to performing the basic auto-capture handshake, it also
provides:

- Automatic cropping of Task Recorder's own side panel out of the screenshot, for a cleaner result
- A configurable manual-capture keyboard shortcut and floating button
- A local screenshot history (thumbnails, copy, download)
- A configurable history size limit

## 2. Installation

1. Type `edge://extensions/` in the address bar (Chrome: `chrome://extensions/`) and press Enter
2. Turn on **Developer mode** (top-right or side toggle)
3. Click **Load unpacked**
4. Select the extension folder:
   - Source version: `D365-TaskRecorder-Enhance`
   - Obfuscated/release version: `D365FO-TaskRecorder-Enhance`
5. Once loaded, the extension icon 📷 appears in the toolbar. Click the toolbar puzzle-piece icon and
   pin it for easier access

> After updating the extension's code, go back to `edge://extensions/` and click **Reload** on the
> extension's card, then **refresh any open D365 F&O tabs** — otherwise the new code won't take
> effect.

## 3. Quick start: recording with auto-capture

1. Open a D365 F&O environment and make sure the extension above is loaded and enabled
2. Start a **Task Recorder** recording as usual (typically from the settings menu or footer toolbar)
3. In the Task Recorder recording dialog, check/confirm the **"Capture screenshots"** option
   - This option only appears/works when the extension is installed and functioning correctly
4. Perform your normal actions (clicks, typing, page navigation, etc.). Every time Task Recorder logs
   a step, the extension automatically captures the currently visible page and saves it to the
   history
5. When recording is finished, you can either:
   - Let Task Recorder generate the process document (Word) itself, using the screenshots relayed by
     this extension
   - Or open the extension popup and copy/download individual screenshots as needed

## 4. Popup interface reference

Click the toolbar icon 📷 to open the settings panel:

| Section | Description |
|---|---|
| **Task Recorder auto-capture** toggle | Controls whether the extension responds to Task Recorder's auto-capture events. When off, recorded steps are not captured automatically — only manual capture still works. **On** by default |
| **Show bottom-right manual capture button** toggle | Controls whether the floating manual-capture button 📷 is shown in the bottom-right corner of the page. **Off** by default so it doesn't interfere with normal page use; turn it on when needed |
| **Capture now** button | Immediately captures the currently active tab once, equivalent to pressing the shortcut |
| **Download all** button | Bulk-downloads all screenshots currently in the history |
| **Clear history** button | Clears the locally saved screenshot history (irreversible — download anything important first) |
| **Manual capture shortcut** | Shows the keyboard shortcut currently bound to the "capture now" command; clicking **"⌨️ Change"** opens the browser's extension shortcuts settings page to customize it |
| **History limit (entries)** | Sets the maximum number of screenshots kept locally; older entries are pruned automatically beyond the limit. Range 1–500, default **30** |
| **History list** | Shows each screenshot's thumbnail, filename, timestamp, and trigger source (Task Recorder / manual); click a thumbnail to view it full-size in a new tab; each entry can be individually "copied" or "downloaded" |

## 5. Three ways to capture manually

In addition to Task Recorder's automatic trigger, you can manually capture the current page at any
time:

1. **The "Capture now" button in the popup**
2. **Keyboard shortcut**: default `Ctrl+Shift+Y` (actual binding depends on the browser), customizable
   via "⌨️ Change" in the popup
3. **The floating button 📷 in the bottom-right corner of the page** (hidden by default — first enable
   "Show bottom-right manual capture button" in the popup)

Manual captures also have the Task Recorder panel cropped out automatically and are saved to the
history, where they can be copied/downloaded.

## 6. Working with screenshot history

- **Copy**: click "Copy" on an entry to write the screenshot to the system clipboard, ready to paste
  directly into Word, Teams, an Azure DevOps work item, etc.
- **Download**: click "Download" on an individual entry, or use "Download all" to export in bulk.
  Files are saved to a `D365TaskRecorder\` subfolder under your local Downloads folder, named
  `TaskRecorder_<menu-item>_<date-time>.png`
- **Storage reminder**: history entries are stored as image data in the browser's local storage,
  subject to the configured history limit (default 30); older entries are pruned automatically beyond
  that. Download anything you need to keep long-term — don't rely solely on the in-extension history
  list

## 7. Why is part of the screenshot cropped out?

While recording, D365 F&O pins a `id="asidePane"` side panel (the recording toolbar/status indicators)
to the right edge of the page. This panel is part of the recording *control* UI, not the business
content itself — capturing it as-is would include it in the screenshot, reducing the polish and
professionalism of the generated process document.

After each capture, this extension detects the width of that panel and uses a canvas to crop out the
matching region on the right side of the screenshot, stretching the remaining content to fill the
frame — producing a "clean" screenshot without that panel. This happens automatically; no
configuration is required.

> In rare custom/special environments, if the control UI still appears in captures, please report the
> actual page structure (e.g. whether the panel really uses `id="asidePane"`) so the cropping logic
> can be adjusted accordingly.

## 8. FAQ

**Q: I can't find the "Capture screenshots" option in the Task Recorder dialog?**
A: Make sure the extension is loaded and **enabled** in `edge://extensions/`, then refresh the D365
F&O page and reopen the Task Recorder dialog.

**Q: I get "Capture failed: Either the '<all_urls>' or activeTab permission is required"?**
A: This means the extension's permissions haven't taken effect. Reload the extension in
`edge://extensions/`, refresh the page, and try again.

**Q: Screenshots aren't being captured automatically while recording?**
A: Check that the "Task Recorder auto-capture" toggle in the popup is on. It's also possible your
D365 F&O version/customization doesn't dispatch the expected screenshot event — in that case, use
manual capture (button or shortcut) as a fallback.

**Q: My history suddenly has fewer entries / I can't find an earlier screenshot?**
A: It may have been auto-pruned due to the "history limit," or "Clear history" may have been clicked.
Download important screenshots promptly — don't rely solely on the in-extension history for
long-term storage.

**Q: My code/settings changes aren't taking effect?**
A: You need to manually click "Reload" on the extension's card in `edge://extensions/`, and refresh
any open D365 F&O tabs — browsers don't hot-reload content scripts already injected into a page.

## 9. Privacy notice

- This extension does not upload screenshots or any data to third-party servers; all screenshot data
  is stored only in the browser's local storage (`chrome.storage.local`) and is copied/downloaded
  manually by the user
- History, settings (toggle states, shortcut, history limit) are stored only in the local browser
  profile, and are cleared when the extension is uninstalled or browser data is cleared

# D365 F&O Task Recorder Enhance 使用手册

版本:1.0.114
适用浏览器:Microsoft Edge / Google Chrome(基于 Chromium,Manifest V3)

## 一、这是什么插件

Dynamics 365 Finance & Operations(D365 F&O)自带的 **Task Recorder** 可以录制操作步骤并生成
带截图的操作手册,但需要浏览器安装一个"截图扩展"配合才能自动截图。本插件就是这个截图扩展的
增强实现,除了完成基本的自动截图握手,还提供了:

- 自动裁掉截图里 Task Recorder 自身的侧边面板,让截图更"干净"
- 可配置的手动截图快捷键和悬浮按钮
- 本地截图历史记录(缩略图、复制、下载)
- 可配置的历史记录条数上限

## 二、安装方法

1. 在 Edge/Chrome 地址栏输入 `edge://extensions/`(Chrome 为 `chrome://extensions/`),回车打开扩展管理页
2. 打开右上角/左侧的 **"开发人员模式"(Developer mode)** 开关
3. 点击 **"加载解压缩的扩展"(Load unpacked)**
4. 选择本插件所在文件夹:
   - 使用源码版:`D365-TaskRecorder-Enhance`
   - 使用混淆(发布)版:`D365FO-TaskRecorder-Enhance`
5. 加载成功后,浏览器工具栏会出现插件图标 📷,建议点击工具栏的"拼图"图标把它固定(Pin)出来,方便后续操作

> 更新插件代码后,需要回到 `edge://extensions/` 页面点击该插件卡片上的 **刷新/重新加载** 按钮,
> 并**刷新已打开的 D365 F&O 页面**,新代码才会生效。

## 三、快速开始:录制并自动截图

1. 打开 D365 F&O 环境,确保上面的插件已加载且未被禁用
2. 正常方式启动 **Task Recorder** 开始录制(通常在设置菜单或页脚工具栏)
3. 在 Task Recorder 弹出的录制面板里,勾选/确认 **"Capture screenshots"(截取屏幕截图)** 选项
   - 只有插件安装且正常工作时,这个选项才会出现或可用
4. 正常操作系统(点击、输入、切换页面等),Task Recorder 每记录一步,本插件会自动截取当前
   可见页面并保存到"历史记录"中
5. 录制结束后,可以:
   - 让 Task Recorder 自己生成操作手册(Word),它会使用本插件回传的截图
   - 或者点击插件图标,在历史记录里单独复制/下载所需的截图

## 四、插件弹窗界面说明

点击工具栏插件图标 📷,会打开如下设置面板:

| 区域 | 说明 |
|---|---|
| **Task Recorder 自动截图** 开关 | 控制是否响应 Task Recorder 派发的自动截图事件。关闭后录制步骤不会自动截图,仅能手动截图。默认**开启** |
| **显示右下角手动截图按钮** 开关 | 控制页面右下角是否显示悬浮的手动截图按钮 📷。默认**关闭**,不干扰页面操作;需要时可自行打开 |
| **立即截图** 按钮 | 点击后立刻对当前活动标签页截图一次,等同于按一次快捷键 |
| **全部下载** 按钮 | 把当前历史记录里的所有截图批量下载到本地 |
| **清空历史** 按钮 | 清空本地保存的截图历史记录(不可恢复,下载前请确认) |
| **立即截图快捷键** | 显示当前"立即截图"命令绑定的快捷键;点击 **"⌨️ 修改"** 会跳转到浏览器的扩展快捷键设置页,可自定义/更改按键组合 |
| **历史记录上限(条)** | 设置本地最多保存多少条截图历史,超出后自动清理最旧的记录。范围 1~500,默认 **30** |
| **历史记录列表** | 显示每张截图的缩略图、文件名、时间、触发方式(Task Recorder / 手动截图);点击缩略图可在新标签页查看大图;每条记录可单独"复制"或"下载" |

## 五、手动截图的三种方式

除了 Task Recorder 自动触发外,任何时候都可以手动截图当前页面:

1. **插件弹窗里的"立即截图"按钮**
2. **快捷键**:默认 `Ctrl+Shift+Y`(具体以浏览器实际分配为准),可在弹窗中点击"⌨️ 修改"自定义
3. **页面右下角悬浮按钮 📷**(默认隐藏,需要先在弹窗里打开"显示右下角手动截图按钮"开关)

手动截图同样会自动裁剪掉 Task Recorder 面板,并保存进历史记录,可在弹窗中复制/下载。

## 六、截图历史记录的使用

- **复制**:点击某条记录的"复制"按钮,截图会写入系统剪贴板,可直接 `Ctrl+V` 粘贴到 Word、
  Teams、Azure DevOps 工作项等地方
- **下载**:点击某条记录的"下载"按钮,或用"全部下载"批量导出,文件会保存到本地"下载"文件夹下的
  `D365TaskRecorder\` 子目录中,文件名格式为 `TaskRecorder_<菜单项>_<日期时间>.png`
- **容量提醒**:历史记录以图片数据保存在浏览器本地存储中,受"历史记录上限"限制(默认 30 条),
  超出后会自动删除最旧的记录。如需长期留存,请及时下载导出,不要仅依赖插件内的历史列表

##七、常见问题(FAQ)

**Q:Task Recorder 弹窗里找不到"Capture screenshots"选项?**
A:请确认插件已在 `edge://extensions/` 中加载且处于"已启用"状态,并刷新一下 D365 F&O 页面
后重新打开 Task Recorder 弹窗。

**Q:提示"截图失败: Either the '<all_urls>' or activeTab permission is required"?**
A:说明插件权限未生效,请到 `edge://extensions/` 重新加载本插件,并刷新页面后重试。

**Q:录制过程中没有自动截图?**
A:检查插件弹窗里的"Task Recorder 自动截图"开关是否已打开;也可能是当前 D365 F&O 版本/自定义
环境未按预期派发截图事件,此时可改用手动截图(按钮或快捷键)作为替代方案。

**Q:历史记录突然变少了/找不到之前的截图?**
A:可能是超出了"历史记录上限"被自动清理,或点击过"清空历史"。请及时下载导出重要截图,
不要仅依赖插件内的历史列表长期保存。

**Q:修改代码/配置后不生效?**
A:需要在 `edge://extensions/` 页面手动点击插件卡片上的"重新加载"按钮,并刷新已打开的
D365 F&O 页面标签,新逻辑才会生效(浏览器不会自动热更新已加载的内容脚本)。

## 八、隐私说明

- 本插件不会将截图或任何数据上传到第三方服务器,所有截图数据仅保存在浏览器本地存储
  (`chrome.storage.local`)中,由用户自行复制或下载导出
- 历史记录、设置(开关状态、快捷键、上限数值)均只保存在本机浏览器配置中,卸载插件或清除
  浏览器数据会一并清空
