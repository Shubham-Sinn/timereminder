async function getConfig() {
  const data = await chrome.storage.local.get(['configLimitMinutes', 'configResetMinutes', 'targetWebsites']);
  return {
    LIMIT_MS: (data.configLimitMinutes || 9) * 60 * 1000,
    RESET_MS: (data.configResetMinutes || 2) * 60 * 1000,
    targetWebsites: data.targetWebsites || ["youtube.com", "x.com", "twitter.com"]
  };
}

async function getState() {
  const data = await chrome.storage.local.get(['domainData', 'currentActiveDomain', 'sessionStart']);
  return {
    domainData: data.domainData || {},
    currentActiveDomain: data.currentActiveDomain || null,
    sessionStart: data.sessionStart !== undefined ? data.sessionStart : null
  };
}

async function saveState(state) {
  await chrome.storage.local.set(state);
}

const getMatchDomain = (url, targetWebsites) => {
  if (!url) return null;
  return targetWebsites.find(site => url.includes(site)) || null;
};

const tabUnlockPercentages = {};
let currentActiveTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateTabProgress" && sender.tab) {
        tabUnlockPercentages[sender.tab.id] = message.percentage;
        updateBadge();
    } else if (message.action === "clearTabProgress" && sender.tab) {
        delete tabUnlockPercentages[sender.tab.id];
        updateBadge();
    } else if (message.action === "heartbeat") {
        checkActiveTab();
    } else if (message.action === "incrementUnlock") {
        getState().then(state => {
            if (message.domain && state.domainData[message.domain]) {
                state.domainData[message.domain].unlockCount = (state.domainData[message.domain].unlockCount || 0) + 1;
                saveState(state);
            }
        });
    } else if (message.action === "getPopupData") {
        (async () => {
             const state = await getState();
             const config = await getConfig();
             const now = Date.now();
             if (state.sessionStart !== null && state.currentActiveDomain) {
                 const dData = state.domainData[state.currentActiveDomain];
                 if (dData) {
                     dData.accumulatedMs += (now - state.sessionStart);
                     if (dData.accumulatedMs >= config.LIMIT_MS) {
                         dData.isBlocked = true;
                     }
                     state.sessionStart = now;
                 }
                 await saveState(state);
             }
             
             const activeTabId = currentActiveTabId;
             let unlockPercentage = undefined;
             if (activeTabId && tabUnlockPercentages[activeTabId] !== undefined) {
                 unlockPercentage = tabUnlockPercentages[activeTabId];
             }
             
             sendResponse({ 
                 domainData: state.domainData, 
                 configLimitMinutes: config.LIMIT_MS / 60000,
                 activeDomain: state.currentActiveDomain,
                 unlockPercentage: unlockPercentage
             });
        })();
        return true; 
    } else if (message.action === "fetchMotivationalQuote") {
        (async () => {
            const fallbacks = [
                "Your future is created by what you do today, not tomorrow.",
                "Success is the sum of small efforts, repeated day in and day out.",
                "Don't watch the clock; do what it does. Keep going.",
                "The only way to do great work is to love what you do.",
                "Opportunities don't happen, you create them through hard work."
            ];
            
            try {
                const res = await fetch("https://zenquotes.io/api/random");
                const data = await res.json();
                if (data && data[0] && data[0].q) {
                    let q = data[0].q;
                    if (q.split(' ').length > 40) {
                        sendResponse({ text: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
                        return;
                    }
                    sendResponse({ text: q });
                    return;
                }
                throw new Error("Invalid format");
            } catch (e) {
                sendResponse({ text: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
            }
        })();
        return true;
    }
});

async function updateBadge() {
  const state = await getState();
  const config = await getConfig();
  const now = Date.now();
  
  let totalMs = 0;
  if (state.currentActiveDomain && state.domainData[state.currentActiveDomain]) {
    totalMs = state.domainData[state.currentActiveDomain].accumulatedMs;
    if (state.sessionStart !== null) {
      totalMs += (now - state.sessionStart);
    }
  }

  const limitMs = config.LIMIT_MS;
  let percentage = Math.min(1, totalMs / limitMs);
  
  if (currentActiveTabId && tabUnlockPercentages[currentActiveTabId] !== undefined) {
      percentage = tabUnlockPercentages[currentActiveTabId];
  }
  
  const canvas = new OffscreenCanvas(16, 16);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  ctx.clearRect(0, 0, 16, 16);
  
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(3, 2);
  ctx.lineTo(13, 2);
  ctx.lineTo(8, 7);
  ctx.lineTo(13, 14);
  ctx.lineTo(3, 14);
  ctx.lineTo(8, 7);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.roundRect(0, 6, 16, 4, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#22c55e";
  ctx.stroke();
  
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 6, 16, 4, 2);
  ctx.clip();
  ctx.fillStyle = '#22c55e';
  let fillWidth = 16 * percentage;
  ctx.fillRect(0, 6, fillWidth, 4);
  ctx.restore();
  
  const imageData = ctx.getImageData(0, 0, 16, 16);
  chrome.action.setIcon({ imageData: imageData });
  chrome.action.setBadgeText({ text: "" });
}

async function evaluateCurrentState(activeDomain) {
  const state = await getState();
  const config = await getConfig();
  const now = Date.now();

  for (const site of config.targetWebsites) {
    if (!state.domainData[site]) {
      state.domainData[site] = { accumulatedMs: 0, lastActiveTime: 0, isBlocked: false, unlockCount: 0 };
    }
  }

  for (const site of config.targetWebsites) {
    const dData = state.domainData[site];
    if (activeDomain !== site || state.sessionStart === null) {
      if (dData.lastActiveTime > 0 && (now - dData.lastActiveTime > config.RESET_MS)) {
        dData.accumulatedMs = 0;
        dData.isBlocked = false;
        dData.unlockCount = 0;
      }
    }
  }

  if (state.sessionStart !== null && state.currentActiveDomain) {
    const timeDelta = now - state.sessionStart;
    const dData = state.domainData[state.currentActiveDomain];
    if (dData) {
      dData.accumulatedMs += timeDelta;
      if (dData.accumulatedMs >= config.LIMIT_MS) {
        dData.isBlocked = true;
      }
      dData.lastActiveTime = now;
    }
  }

  state.currentActiveDomain = activeDomain;
  state.sessionStart = activeDomain ? now : null;

  for (const site of config.targetWebsites) {
    if (state.domainData[site] && state.domainData[site].accumulatedMs >= config.LIMIT_MS) {
       state.domainData[site].isBlocked = true;
    }
  }

  chrome.alarms.clear("blockAlarm");
  chrome.alarms.clear("badgeUpdate");
  
  if (activeDomain && state.domainData[activeDomain]) {
    const dData = state.domainData[activeDomain];
    let remainingMs = config.LIMIT_MS - dData.accumulatedMs;
    if (remainingMs <= 0) remainingMs = 1;
    chrome.alarms.create("blockAlarm", { when: now + remainingMs });
    chrome.alarms.create("badgeUpdate", { periodInMinutes: 1 });
  }

  await saveState(state);
  updateBadge();
}

async function checkActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs.length === 0) {
    currentActiveTabId = null;
    await evaluateCurrentState(null);
    return;
  }
  const activeTab = tabs[0];
  currentActiveTabId = activeTab.id;
  const config = await getConfig();
  await evaluateCurrentState(getMatchDomain(activeTab.url, config.targetWebsites));
}

chrome.tabs.onActivated.addListener(checkActiveTab);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active) {
    checkActiveTab();
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    evaluateCurrentState(null);
  } else {
    checkActiveTab();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "blockAlarm") {
    checkActiveTab();
  } else if (alarm.name === "badgeUpdate") {
    updateBadge();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.configLimitMinutes || changes.configResetMinutes || changes.targetWebsites)) {
        checkActiveTab();
    }
});

chrome.runtime.onStartup.addListener(() => {
    checkActiveTab();
});
chrome.runtime.onInstalled.addListener(() => {
    checkActiveTab();
});
