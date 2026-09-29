// background.js (Service Worker)
// 负责: 1) 实际调用 chrome.tabs.captureVisibleTab 截图（带节流重试）
//      2) 维护截图历史记录 (chrome.storage.local)
//      3) 提供复制到剪贴板 / 下载 / 清空历史 的消息接口
//      4) 响应快捷键,转发"手动截图"指令给当前活动标签页

const HISTORY_KEY = "screenshotHistory";
const MAX_HISTORY_KEY = "maxHistoryCount";
const DEFAULT_MAX_HISTORY = 30; // 历史记录上限默认值,避免 storage.local 占用过大;可在弹窗中配置
const CAPTURE_MIN_INTERVAL_MS = 550; // chrome.tabs.captureVisibleTab 官方限速约为 2 次/秒
const MAX_RETRIES = 4;

let lastCaptureTime = 0;
let captureQueue = Promise.resolve();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaError(message) {
  return !!message && /MAX_CAPTURE_VISIBLE_TAB|quota/i.test(message);
}

// 带节流与重试的截图封装
async function captureVisibleTabSafely(windowId) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const waitMs = Math.max(0, CAPTURE_MIN_INTERVAL_MS - (Date.now() - lastCaptureTime));
    if (waitMs > 0) await delay(waitMs);
    lastCaptureTime = Date.now();

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const cb = (result) => {
          if (chrome.runtime.lastError || !result) {
            reject(new Error(chrome.runtime.lastError?.message || "空截图结果"));
            return;
          }
          resolve(result);
        };
        if (typeof windowId === "number") {
          chrome.tabs.captureVisibleTab(windowId, { format: "png" }, cb);
        } else {
          chrome.tabs.captureVisibleTab({ format: "png" }, cb);
        }
      });
      return dataUrl;
    } catch (err) {
      lastError = err;
      const backoff = isQuotaError(err.message)
        ? CAPTURE_MIN_INTERVAL_MS * attempt
        : 300 * attempt;
      console.warn(`[TR Enhance BG] 截图第 ${attempt}/${MAX_RETRIES} 次失败:`, err.message);
      if (attempt < MAX_RETRIES) await delay(backoff);
    }
  }
  throw lastError || new Error("截图失败(已达最大重试次数)");
}

function buildFileName(context) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("") + "-" + [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const menuItem = (context?.menuItem || "step").replace(/[^\w-]+/g, "_").slice(0, 40);
  return `TaskRecorder_${menuItem}_${stamp}.png`;
}

async function getHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
}

// 读取用户配置的历史记录上限(未配置时使用默认值 30)
async function getMaxHistory() {
  const data = await chrome.storage.local.get(MAX_HISTORY_KEY);
  const value = Number(data[MAX_HISTORY_KEY]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MAX_HISTORY;
}

async function saveToHistory(entry) {
  const history = await getHistory();
  history.unshift(entry); // 最新的在最前面
  const maxHistory = await getMaxHistory();
  while (history.length > maxHistory) history.pop();
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
  return history.length;
}

async function updateBadge() {
  const history = await getHistory();
  chrome.action.setBadgeText({ text: history.length ? String(history.length) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#0078d4" });
}

// ---------- 消息路由 ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "captureStep") {
    const windowId = sender.tab?.windowId;
    const task = captureQueue.then(async () => {
      const dataUrl = await captureVisibleTabSafely(windowId);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataUrl,
        fileName: buildFileName(message.context),
        context: message.context || {},
        trigger: message.trigger || "unknown",
        capturedAt: new Date().toISOString(),
      };
      const count = await saveToHistory(entry);
      await updateBadge();
      return { success: true, count, id: entry.id, dataUrl: entry.dataUrl };
    });
    captureQueue = task.catch(() => {}); // 保证队列继续,即使单次失败
    task
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 异步响应
  }

  // content script 裁剪掉 Task Recorder 侧边面板(asidePane)后,回写替换历史记录里的截图数据
  if (message?.action === "updateScreenshotData") {
    (async () => {
      const history = await getHistory();
      const entry = history.find((h) => h.id === message.id);
      if (entry && typeof message.dataUrl === "string") {
        entry.dataUrl = message.dataUrl;
        await chrome.storage.local.set({ [HISTORY_KEY]: history });
      }
      sendResponse({ success: !!entry });
    })();
    return true;
  }

  if (message?.action === "copyScreenshot") {
    copyToClipboard(message.id).then(sendResponse).catch((err) =>
      sendResponse({ success: false, error: err.message })
    );
    return true;
  }

  if (message?.action === "downloadScreenshot") {
    downloadOne(message.id).then(sendResponse).catch((err) =>
      sendResponse({ success: false, error: err.message })
    );
    return true;
  }

  if (message?.action === "downloadAll") {
    downloadAll().then(sendResponse).catch((err) =>
      sendResponse({ success: false, error: err.message })
    );
    return true;
  }

  if (message?.action === "clearHistory") {
    chrome.storage.local.set({ [HISTORY_KEY]: [] }, async () => {
      await updateBadge();
      sendResponse({ success: true });
    });
    return true;
  }

  if (message?.action === "getHistory") {
    getHistory().then((history) => sendResponse({ success: true, history }));
    return true;
  }

  if (message?.action === "getMaxHistory") {
    getMaxHistory().then((maxHistory) => sendResponse({ success: true, maxHistory }));
    return true;
  }

  // 更新历史记录上限;若新上限比当前记录数小,立即裁剪多余的旧记录
  if (message?.action === "setMaxHistory") {
    (async () => {
      const value = Number(message.maxHistory);
      const maxHistory = Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MAX_HISTORY;
      await chrome.storage.local.set({ [MAX_HISTORY_KEY]: maxHistory });
      const history = await getHistory();
      if (history.length > maxHistory) {
        const trimmed = history.slice(0, maxHistory);
        await chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
        await updateBadge();
      }
      sendResponse({ success: true, maxHistory });
    })();
    return true;
  }

  return false;
});

// ---------- 剪贴板复制(经由 offscreen 文档,MV3 service worker 无 DOM 剪贴板权限) ----------
let creatingOffscreen;
async function ensureOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: "将截图 PNG 写入系统剪贴板",
  });
  await creatingOffscreen;
  creatingOffscreen = null;
}

async function copyToClipboard(id) {
  const history = await getHistory();
  const entry = history.find((h) => h.id === id) || history[0];
  if (!entry) return { success: false, error: "没有可复制的截图" };

  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    target: "tr-enhance-offscreen",
    action: "copyImage",
    dataUrl: entry.dataUrl,
  });
  return response || { success: false, error: "offscreen 未响应" };
}

// ---------- 下载 ----------
async function downloadOne(id) {
  const history = await getHistory();
  const entry = history.find((h) => h.id === id) || history[0];
  if (!entry) return { success: false, error: "没有可下载的截图" };

  return new Promise((resolve) => {
    chrome.downloads.download(
      { url: entry.dataUrl, filename: `D365TaskRecorder/${entry.fileName}`, saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError || downloadId == null) {
          resolve({ success: false, error: chrome.runtime.lastError?.message || "下载失败" });
          return;
        }
        resolve({ success: true, downloadId });
      }
    );
  });
}

async function downloadAll() {
  const history = await getHistory();
  if (!history.length) return { success: false, error: "历史记录为空" };
  let ok = 0;
  for (const entry of history) {
    const result = await downloadOne(entry.id);
    if (result.success) ok += 1;
  }
  return { success: true, count: ok, total: history.length };
}

// ---------- 快捷键: 手动截图 ----------
chrome.commands.onCommand.addListener((command) => {
  if (command !== "manual-capture") return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { action: "triggerManualCapture" }).catch(() => {});
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([HISTORY_KEY, MAX_HISTORY_KEY], (data) => {
    if (!Array.isArray(data[HISTORY_KEY])) {
      chrome.storage.local.set({ [HISTORY_KEY]: [] });
    }
    if (!Number.isFinite(Number(data[MAX_HISTORY_KEY]))) {
      chrome.storage.local.set({ [MAX_HISTORY_KEY]: DEFAULT_MAX_HISTORY });
    }
  });
  updateBadge();
});
