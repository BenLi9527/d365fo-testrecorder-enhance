// offscreen.js
// 在离屏文档中执行剪贴板写入(Service Worker 没有 DOM/Clipboard API 访问权限)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "tr-enhance-offscreen" || message.action !== "copyImage") {
    return false;
  }

  (async () => {
    try {
      const dataUrl = message.dataUrl;
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();

  return true; // 异步响应
});
