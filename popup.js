// popup.js

const AUTO_CAPTURE_KEY = "autoCaptureEnabled";
const SHOW_FAB_KEY = "showManualFab"; // 右下角手动截图悬浮按钮是否显示,默认关闭

const autoToggle = document.getElementById("autoToggle");
const fabToggle = document.getElementById("fabToggle");
const historyEl = document.getElementById("history");
const manualCaptureBtn = document.getElementById("manualCapture");
const downloadAllBtn = document.getElementById("downloadAll");
const clearAllBtn = document.getElementById("clearAll");
const shortcutValueEl = document.getElementById("shortcutValue");
const configShortcutBtn = document.getElementById("configShortcut");
const maxHistoryInput = document.getElementById("maxHistoryInput");

// 读取当前"立即截图"命令实际绑定的快捷键(用户可能已在 shortcuts 页面自定义过)
function loadShortcut() {
  chrome.commands.getAll((commands) => {
    const cmd = commands.find((c) => c.name === "manual-capture");
    shortcutValueEl.textContent = cmd?.shortcut || "未设置(点击右侧按钮设置)";
  });
}

// 跳转到浏览器的扩展快捷键设置页,用户可在此自定义/更改快捷键
configShortcutBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// 读取/保存历史记录上限(默认 30,由 background.js 统一裁剪)
function loadMaxHistory() {
  chrome.runtime.sendMessage({ action: "getMaxHistory" }, (res) => {
    maxHistoryInput.value = res?.maxHistory ?? 30;
  });
}

maxHistoryInput.addEventListener("change", () => {
  let value = parseInt(maxHistoryInput.value, 10);
  if (!Number.isFinite(value) || value < 1) value = 30;
  if (value > 500) value = 500; // 避免误输入导致 storage.local 占用过大
  maxHistoryInput.value = value;
  chrome.runtime.sendMessage({ action: "setMaxHistory", maxHistory: value }, () => {
    loadHistory(); // 若上限变小,需要刷新列表以反映被裁剪的记录
  });
});

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function renderHistory(history) {
  historyEl.innerHTML = "";
  if (!history || history.length === 0) {
    historyEl.innerHTML = '<div class="empty">暂无截图记录</div>';
    return;
  }
  for (const entry of history) {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <img src="${entry.dataUrl}" alt="thumb" />
      <div class="meta">
        <div class="name">${entry.fileName}</div>
        <div class="time">${formatTime(entry.capturedAt)} · ${entry.trigger}</div>
      </div>
      <div class="btns">
        <button data-action="copy" data-id="${entry.id}">复制</button>
        <button data-action="download" data-id="${entry.id}">下载</button>
      </div>
    `;
    item.querySelector("img").addEventListener("click", () => {
      chrome.tabs.create({ url: entry.dataUrl });
    });
    historyEl.appendChild(item);
  }
}

function loadHistory() {
  chrome.runtime.sendMessage({ action: "getHistory" }, (res) => {
    renderHistory(res?.history || []);
  });
}

function loadSettings() {
  chrome.storage.local.get([AUTO_CAPTURE_KEY, SHOW_FAB_KEY], (data) => {
    autoToggle.checked = data[AUTO_CAPTURE_KEY] !== false;
    fabToggle.checked = data[SHOW_FAB_KEY] === true; // 默认关闭
  });
}

autoToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [AUTO_CAPTURE_KEY]: autoToggle.checked });
});

fabToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SHOW_FAB_KEY]: fabToggle.checked });
});

manualCaptureBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { action: "triggerManualCapture" }, () => {
      setTimeout(loadHistory, 800); // 等待截图完成后刷新列表
    });
  });
});

downloadAllBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "downloadAll" }, (res) => {
    if (!res?.success) alert(res?.error || "下载失败");
  });
});

clearAllBtn.addEventListener("click", () => {
  if (!confirm("确定要清空所有截图历史吗?")) return;
  chrome.runtime.sendMessage({ action: "clearHistory" }, () => loadHistory());
});

historyEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === "copy") {
    chrome.runtime.sendMessage({ action: "copyScreenshot", id }, (res) => {
      btn.textContent = res?.success ? "已复制" : "失败";
      setTimeout(() => (btn.textContent = "复制"), 1200);
    });
  } else if (action === "download") {
    chrome.runtime.sendMessage({ action: "downloadScreenshot", id }, (res) => {
      btn.textContent = res?.success ? "已下载" : "失败";
      setTimeout(() => (btn.textContent = "下载"), 1200);
    });
  }
});

// storage 变化时(如自动截图产生新记录)实时刷新
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.screenshotHistory) {
    renderHistory(changes.screenshotHistory.newValue || []);
  }
});

loadSettings();
loadHistory();
loadShortcut();
loadMaxHistory();
