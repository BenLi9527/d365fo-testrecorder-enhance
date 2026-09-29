// content.js
// 注入到 D365 F&O 页面。核心思路:
// 1) D365 F&O 客户端的 Task Recorder **不会**对任意页面自动派发截图事件——它要求页面上
//    存在一个约定的隐藏标记元素 <div id="screenshotExtensionIsInstalled">,用来探测
//    "已安装兼容的截图扩展"。探测到之后,Task Recorder 弹窗才会出现
//    "Capture screenshots" 开关,并在录制每一步时在 document 上派发 "screenshot" 事件。
//    —— 这一步"握手"是本插件之前遗漏、导致截图功能完全不触发的根本原因。
// 2) 我们监听该 "screenshot" 事件,委托后台 Service Worker 用
//    chrome.tabs.captureVisibleTab 截取当前可见标签页,连同页面上下文一起交给后台处理
//    (写入历史记录、复制到剪贴板、或另存为文件),并把截图通过 window.postMessage
//    回传给页面,供 D365 F&O 自身的 Task Recorder / Word 导出逻辑内嵌使用。
// 3) 同时提供手动截图入口(快捷键 / 页面右下角悬浮按钮),不依赖 Task Recorder 事件。
// 4) 排除 Task Recorder 控制面板:参考微软官方 D365 Power Hub 扩展的做法——
//    D365 F&O 客户端把 Task Recorder(以及其它侧边浮出面板)固定渲染在
//    <div id="asidePane"> 容器里,该容器停靠在窗口右侧。截图本身仍是整页可见区域的
//    完整截图(chrome.tabs.captureVisibleTab 无法只截取部分区域),因此拿到原始截图后,
//    在 content script 里用 canvas 按 asidePane 的实际宽度(换算成截图像素)把右侧这块
//    区域裁掉,并把剩余部分拉伸铺满,得到一张不包含 Task Recorder 面板的图片,再替换
//    历史记录里保存的截图数据、以及回传给页面的截图数据。
//    另外,截图前也会临时隐藏本插件自己注入的悬浮按钮/Toast,截图完成后立即恢复。

(function () {
  const MARKER_ID = "screenshotExtensionIsInstalled";
  const AUTO_CAPTURE_KEY = "autoCaptureEnabled";
  const SHOW_FAB_KEY = "showManualFab"; // 右下角手动截图悬浮按钮是否显示,默认关闭
  let autoCaptureEnabled = true;
  let capturing = false;
  let markerObserver;

  // ---------- 排除 Task Recorder 侧边面板(asidePane)后再使用截图 ----------
  // D365 F&O 把 Task Recorder 录制控制条(以及其它侧边浮出面板)渲染在固定 id 为
  // "asidePane" 的容器里,停靠在窗口右侧。截图 API 只能截整个可见区域,所以这里在拿到
  // 原始截图后用 canvas 把 asidePane 对应宽度的区域裁掉,再把剩余内容拉伸铺满画布,
  // 得到一张不包含该面板的图片。找不到 asidePane 或其宽度为 0 时原样返回,不影响截图。
  function cropAsidePane(dataUrl) {
    return new Promise((resolve) => {
      const asidePane = document.getElementById("asidePane");
      if (!asidePane || asidePane.clientWidth <= 0) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const imgWidth = img.naturalWidth || img.width;
          const imgHeight = img.naturalHeight || img.height;
          if (imgWidth <= 0 || imgHeight <= 0) {
            resolve(dataUrl);
            return;
          }
          // 截图像素 与 CSS 像素 的缩放比例:优先用"实际截图宽度 / 视口宽度"换算,
          // 比直接用 devicePixelRatio 更准确(可兼顾浏览器缩放等因素)
          const viewportWidth = window.innerWidth || document.documentElement.clientWidth || imgWidth;
          const scale = viewportWidth > 0 ? imgWidth / viewportWidth : (window.devicePixelRatio || 1);
          const paneWidthPx = Math.round(asidePane.clientWidth * scale);
          if (paneWidthPx <= 0 || paneWidthPx >= imgWidth) {
            resolve(dataUrl);
            return;
          }
          const keepWidthPx = Math.max(1, imgWidth - paneWidthPx);
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          canvas.width = imgWidth;
          canvas.height = imgHeight;
          // 取源图左侧(去掉右侧 Task Recorder 面板宽度)的区域,拉伸铺满整个画布,
          // 使输出图片尺寸与原图保持一致,但不再包含 Task Recorder 面板内容
          ctx.drawImage(img, 0, 0, keepWidthPx, imgHeight, 0, 0, imgWidth, imgHeight);
          resolve(canvas.toDataURL("image/png"));
        } catch (err) {
          console.error("[TR Enhance] 裁剪截图失败:", err);
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        console.error("[TR Enhance] 截图解码失败,跳过裁剪");
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  }

  // 隐藏本插件自己的悬浮按钮/Toast,返回用于恢复的记录列表
  function hideOwnUi() {
    const hidden = [];
    const targets = [
      document.getElementById("tr-enhance-fab"),
      document.getElementById("tr-enhance-toast"),
    ].filter(Boolean);
    for (const el of targets) {
      hidden.push({ el, prevValue: el.style.getPropertyValue("visibility"), prevPriority: el.style.getPropertyPriority("visibility") });
      el.style.setProperty("visibility", "hidden", "important");
    }
    return hidden;
  }

  // 恢复隐藏前的原始 visibility 样式
  function restoreOwnUi(hidden) {
    for (const { el, prevValue, prevPriority } of hidden) {
      if (prevValue) el.style.setProperty("visibility", prevValue, prevPriority);
      else el.style.removeProperty("visibility");
    }
  }

  // 等待一帧渲染完成,确保隐藏样式已生效后再截图
  function waitForNextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  // ---------- 握手标记元素:告诉 D365 F&O 页面"截图扩展已安装" ----------
  function insertMarker() {
    if (!document.body || document.getElementById(MARKER_ID)) return;
    const marker = document.createElement("div");
    marker.id = MARKER_ID;
    marker.style.display = "none";
    document.body.insertBefore(marker, document.body.firstChild);
  }

  function removeMarker() {
    document.getElementById(MARKER_ID)?.remove();
  }

  // D365 F&O 是单页应用,会重建/替换 body 内容,需要持续监视并重新插入标记
  function ensureMarkerPresence() {
    if (!autoCaptureEnabled) return;
    insertMarker();
    if (markerObserver) return;
    markerObserver = new MutationObserver(() => {
      if (autoCaptureEnabled && document.body && !document.getElementById(MARKER_ID)) {
        insertMarker();
      }
    });
    if (document.documentElement) {
      markerObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function applyAutoCaptureState(enabled) {
    autoCaptureEnabled = enabled;
    if (enabled) {
      if (document.body) ensureMarkerPresence();
      else document.addEventListener("DOMContentLoaded", () => ensureMarkerPresence(), { once: true });
    } else {
      removeMarker();
    }
  }

  // ---------- 读取/同步设置 ----------
  chrome.storage.local.get([AUTO_CAPTURE_KEY], (data) => {
    applyAutoCaptureState(data[AUTO_CAPTURE_KEY] !== false); // 默认开启
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[AUTO_CAPTURE_KEY]) {
      applyAutoCaptureState(changes[AUTO_CAPTURE_KEY].newValue !== false);
    }
  });

  // ---------- 把截图回传给页面,供 D365 F&O 自身逻辑(如导出 Word)内嵌使用 ----------
  function postScreenshotToPage(dataUrl) {
    if (!dataUrl) return;
    try {
      window.postMessage(dataUrl, window.location.origin);
    } catch (err) {
      console.error("[TR Enhance] postMessage 回传截图失败:", err);
    }
  }

  // ---------- 提取页面上下文,便于截图归档命名 ----------
  function getPageContext() {
    const url = new URL(location.href);
    const menuItem =
      url.searchParams.get("mi") || url.hash.match(/mi=([^&]+)/)?.[1] || "";
    const company =
      url.searchParams.get("cmp") || url.hash.match(/cmp=([^&]+)/)?.[1] || "";
    const formTitle = document.title || "";
    return { menuItem, company, formTitle, url: location.href };
  }

  // ---------- 请求后台执行截图 ----------
  async function requestCapture(trigger) {
    if (capturing) return; // 避免并发重复截图
    capturing = true;
    const context = getPageContext();

    // 截图前临时隐藏本插件自己的悬浮按钮/Toast,避免拍入截图
    const hidden = hideOwnUi();
    if (hidden.length) await waitForNextPaint();

    chrome.runtime.sendMessage(
      { action: "captureStep", context, trigger },
      async (response) => {
        capturing = false;
        restoreOwnUi(hidden); // 无论成功失败都要先恢复界面
        if (chrome.runtime.lastError) {
          console.error(
            "[TR Enhance] 截图请求失败:",
            chrome.runtime.lastError.message
          );
          showToast("截图失败: " + chrome.runtime.lastError.message, true);
          return;
        }
        if (response?.success) {
          // 裁剪掉 Task Recorder 侧边面板(asidePane),避免其出现在保存/回传的截图里
          const croppedDataUrl = await cropAsidePane(response.dataUrl);
          if (croppedDataUrl !== response.dataUrl) {
            chrome.runtime
              .sendMessage({
                action: "updateScreenshotData",
                id: response.id,
                dataUrl: croppedDataUrl,
              })
              .catch(() => {});
          }
          showToast(`已截图 (第 ${response.count} 张)`);
          if (trigger === "task-recorder") postScreenshotToPage(croppedDataUrl);
        } else {
          showToast("截图失败: " + (response?.error || "未知错误"), true);
        }
      }
    );
  }

  // ---------- 监听 D365 F&O Task Recorder 派发的 "screenshot" 事件 ----------
  document.addEventListener("screenshot", () => {
    if (!autoCaptureEnabled) {
      console.log("[TR Enhance] 收到截图事件,但自动截图已关闭,已忽略");
      return;
    }
    requestCapture("task-recorder");
  });

  // ---------- 监听后台转发的快捷键手动截图指令 ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.action === "triggerManualCapture") {
      requestCapture("manual-shortcut");
    }
  });

  // ---------- 页面悬浮手动截图按钮(是否显示由弹窗中的开关控制,默认关闭) ----------
  function injectFloatingButton() {
    if (document.getElementById("tr-enhance-fab")) return;
    const btn = document.createElement("button");
    btn.id = "tr-enhance-fab";
    btn.title = "手动截图 (D365 F&O Task Recorder Enhance)";
    btn.textContent = "📷";
    Object.assign(btn.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: 2147483647,
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      border: "none",
      background: "#0078d4",
      color: "#fff",
      fontSize: "18px",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    });
    btn.addEventListener("click", () => requestCapture("manual-button"));
    document.documentElement.appendChild(btn);
  }

  function removeFloatingButton() {
    document.getElementById("tr-enhance-fab")?.remove();
  }

  function applyFabVisibility(show) {
    if (show) {
      if (document.body) injectFloatingButton();
      else document.addEventListener("DOMContentLoaded", injectFloatingButton, { once: true });
    } else {
      removeFloatingButton();
    }
  }

  chrome.storage.local.get([SHOW_FAB_KEY], (data) => {
    applyFabVisibility(data[SHOW_FAB_KEY] === true); // 默认关闭
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SHOW_FAB_KEY]) {
      applyFabVisibility(changes[SHOW_FAB_KEY].newValue === true);
    }
  });

  // ---------- 简易 Toast 提示 ----------
  let toastTimer;
  function showToast(text, isError) {
    let toast = document.getElementById("tr-enhance-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "tr-enhance-toast";
      Object.assign(toast.style, {
        position: "fixed",
        right: "16px",
        bottom: "68px",
        zIndex: 2147483647,
        padding: "8px 14px",
        borderRadius: "6px",
        color: "#fff",
        fontSize: "13px",
        fontFamily: "Segoe UI, sans-serif",
        transition: "opacity 0.3s",
      });
      document.documentElement.appendChild(toast);
    }
    toast.style.background = isError ? "#c62828" : "#2e7d32";
    toast.textContent = text;
    toast.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.style.opacity = "0"), 2000);
  }

})();
