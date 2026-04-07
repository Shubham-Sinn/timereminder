// content.js

const UNLOCK_WAIT_SEC = 10;
let UNLOCK_DURATION_MS = 9 * 60 * 1000;

safeStorageGet(['configLimitMinutes'], (data) => {
    if (data && data.configLimitMinutes) {
        UNLOCK_DURATION_MS = data.configLimitMinutes * 60 * 1000;
    }
});

let isLocalUnlocked = false;
let unlockTimeout = null;
let currentObserver = null;

function safeStorageGet(keys, callback) {
  try {
    if (!chrome.runtime?.id) return;
    chrome.storage.local.get(keys, (data) => {
      try {
        if (chrome.runtime.lastError) return;
        if (callback) callback(data);
      } catch (e) {
        if (e.message && e.message.includes("Extension context invalidated")) {
          window.location.reload();
        }
      }
    });
  } catch (e) {
    if (e.message && e.message.includes("Extension context invalidated")) {
      window.location.reload();
    }
  }
}

function safeSendMessage(msg) {
  try {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage(msg, () => {
      try {
        if (chrome.runtime.lastError) {
          // Ignored
        }
      } catch (e) {
        if (e.message && e.message.includes("Extension context invalidated")) {
          window.location.reload();
        }
      }
    });
  } catch (e) {
    if (e.message && e.message.includes("Extension context invalidated")) {
      window.location.reload();
    }
  }
}

let myDomain = null;
let prefetchedQuote = "Your future is created by what you do today, not tomorrow.";

function prefetchQuote() {
    try {
        if (!chrome.runtime?.id) return;
        chrome.runtime.sendMessage({ action: "fetchMotivationalQuote" }, (response) => {
            if (!chrome.runtime.lastError && response && response.text) {
                prefetchedQuote = response.text;
            }
        });
    } catch(e) {}
}

async function shouldRun() {
  return new Promise((resolve) => {
    try {
      if (!chrome.runtime?.id) return resolve(false);
      chrome.storage.local.get(['targetWebsites'], (data) => {
        try {
          if (chrome.runtime.lastError) return resolve(false);
          const targetWebsites = data.targetWebsites || ["youtube.com", "x.com", "twitter.com"];
          myDomain = targetWebsites.find(site => window.location.href.includes(site));
          resolve(!!myDomain);
        } catch (e) {
          resolve(false);
        }
      });
    } catch (e) {
      resolve(false);
    }
  });
}

function initUI() {
  if (document.getElementById('tr-overlay')) return;

  const overlay = document.createElement('dialog');
  overlay.id = 'tr-overlay';
  
  const title = document.createElement('h1');
  title.id = 'tr-title';
  title.textContent = 'Times up!';
  
  const subtitle = document.createElement('div');
  subtitle.id = 'tr-subtitle';
  subtitle.textContent = "Take a break, you've reached your limit.";
  
  const settingsContainer = document.createElement('div');
  settingsContainer.id = 'tr-settings-container';
  
  const settingsMenu = document.createElement('div');
  settingsMenu.id = 'tr-settings-menu';
  
  const quoteDisplay = document.createElement('p');
  quoteDisplay.id = 'tr-quote-display';
  
  const quoteInput = document.createElement('textarea');
  quoteInput.id = 'tr-quote-input';
  quoteInput.placeholder = 'Type the quote above exactly to unlock...';
  
  // Stop propagation so typing Space or F doesn't interact with YouTube underneath
  quoteInput.addEventListener('keydown', (e) => e.stopPropagation());
  quoteInput.addEventListener('keyup', (e) => e.stopPropagation());
  quoteInput.addEventListener('keypress', (e) => e.stopPropagation());
  
  const unlockBtn = document.createElement('button');
  unlockBtn.id = 'tr-unlock-btn';
  unlockBtn.textContent = 'Unlock';
  unlockBtn.disabled = true;
  unlockBtn.style.opacity = '0.5';
  unlockBtn.style.cursor = 'not-allowed';

  quoteInput.addEventListener('input', () => {
     const currentQuoteText = quoteInput.dataset.quote || "";
     if (currentQuoteText && quoteInput.value.trim() === currentQuoteText.trim()) {
         unlockBtn.disabled = false;
         unlockBtn.style.opacity = '1';
         unlockBtn.style.cursor = 'pointer';
     } else {
         unlockBtn.disabled = true;
         unlockBtn.style.opacity = '0.5';
         unlockBtn.style.cursor = 'not-allowed';
     }
  });

  settingsMenu.appendChild(quoteDisplay);
  settingsMenu.appendChild(quoteInput);
  settingsMenu.appendChild(unlockBtn);
  
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'tr-settings-btn';
  
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  
  const circle = document.createElementNS(svgNS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "3");
  
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z");

  svg.appendChild(circle);
  svg.appendChild(path);
  
  settingsBtn.appendChild(svg);
  
  settingsContainer.appendChild(settingsMenu);
  settingsContainer.appendChild(settingsBtn);
  
  overlay.appendChild(title);
  overlay.appendChild(subtitle);
  overlay.appendChild(settingsContainer);

  document.body.appendChild(overlay);

  settingsBtn.addEventListener('click', () => {
    settingsMenu.classList.toggle('tr-menu-active');
  });

  unlockBtn.addEventListener('click', () => {
    if (unlockBtn.disabled) return;
    
    // Start Wait Timer
    unlockBtn.disabled = true;
    settingsMenu.classList.remove('tr-menu-active');
    
    let timeRemaining = UNLOCK_WAIT_SEC;
    subtitle.innerText = `Unlocking in ${timeRemaining}...`;
    subtitle.style.color = '#ff8e53';
    
    const interval = setInterval(() => {
      timeRemaining -= 1;
      if (timeRemaining > 0) {
        subtitle.innerText = `Unlocking in ${timeRemaining}...`;
      } else {
        clearInterval(interval);
        performUnlock();
      }
    }, 1000);
  });
}

function performUnlock() {
  const overlay = document.getElementById('tr-overlay');
  const subtitle = document.getElementById('tr-subtitle');
  const unlockBtn = document.getElementById('tr-unlock-btn');
  
  overlay.classList.remove('tr-active');
  isLocalUnlocked = true;
  
  if (unlockTimeout) clearTimeout(unlockTimeout);
  
  let passedMs = 0;
  safeSendMessage({ action: "updateTabProgress", percentage: 0 });
  safeSendMessage({ action: "incrementUnlock", domain: myDomain });
  
  let localProgressInterval = setInterval(() => {
      passedMs += 1000;
      if (!isLocalUnlocked || passedMs >= UNLOCK_DURATION_MS) {
          clearInterval(localProgressInterval);
          safeSendMessage({ action: "clearTabProgress" });
      } else {
          let p = passedMs / UNLOCK_DURATION_MS;
          safeSendMessage({ action: "updateTabProgress", percentage: p });
      }
  }, 1000);

  unlockTimeout = setTimeout(() => {
    isLocalUnlocked = false;
    unlockBtn.disabled = false;
    subtitle.innerText = "Take a break, you've reached your limit.";
    subtitle.style.color = '#94a3b8';
    
    // Check if we still need to block
    safeStorageGet(['domainData'], (data) => {
      if (data && data.domainData && myDomain && data.domainData[myDomain]) {
        evaluateBlockState(data.domainData[myDomain].isBlocked);
      }
    });
  }, UNLOCK_DURATION_MS);
}

function evaluateBlockState(isBlocked) {
  const overlay = document.getElementById('tr-overlay');
  if (!overlay) return;
  
  if (isBlocked && !isLocalUnlocked) {
    if (!overlay.open) {
      try { overlay.showModal(); } catch (e) {}
      
      const quoteDisplay = document.getElementById('tr-quote-display');
      const quoteInput = document.getElementById('tr-quote-input');
      const unlockBtn = document.getElementById('tr-unlock-btn');
      
      if (quoteDisplay && quoteInput && unlockBtn) {
          quoteDisplay.textContent = prefetchedQuote;
          quoteInput.value = "";
          quoteInput.disabled = false;
          unlockBtn.disabled = true;
          unlockBtn.style.opacity = '0.5';
          unlockBtn.style.cursor = 'not-allowed';
          quoteInput.dataset.quote = prefetchedQuote;
          
          prefetchQuote();
      }
    }
    overlay.classList.add('tr-active');
    
    // Force pause all media
    document.querySelectorAll('video, audio').forEach(media => {
        if (!media.paused) media.pause();
    });
  } else {
    if (overlay.open) {
      try { overlay.close(); } catch (e) {}
    }
    overlay.classList.remove('tr-active');
  }
}

// Initialization and Listeners
function bootstrap() {
  initUI();
  safeStorageGet(['domainData'], (data) => {
    if (data && data.domainData && myDomain && data.domainData[myDomain]) {
      evaluateBlockState(data.domainData[myDomain].isBlocked);
    }
  });
}

async function start() {
  const run = await shouldRun();
  if (!run) return;

  prefetchQuote();

  try {
    if (chrome.runtime?.id) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        try {
          if (namespace === 'local' && changes.configLimitMinutes) {
              UNLOCK_DURATION_MS = changes.configLimitMinutes.newValue * 60 * 1000;
          }
          if (namespace === 'local' && changes.domainData && changes.domainData.newValue && myDomain) {
            const newDomainData = changes.domainData.newValue[myDomain];
            if (newDomainData && newDomainData.isBlocked !== undefined) {
              evaluateBlockState(newDomainData.isBlocked);
              
              // If globally unblocked (away reset), reset local states
              if (newDomainData.isBlocked === false) {
                isLocalUnlocked = false;
                if (unlockTimeout) clearTimeout(unlockTimeout);
                const subtitle = document.getElementById('tr-subtitle');
                const unlockBtn = document.getElementById('tr-unlock-btn');
                if (subtitle) {
                    subtitle.innerText = "Take a break, you've reached your limit.";
                    subtitle.style.color = '#94a3b8';
                }
                if (unlockBtn) {
                    unlockBtn.disabled = false;
                }
              }
            }
          }
        } catch (e) {
          // Ignore orphaned script errors
        }
      });
    }
  } catch (e) {}

  currentObserver = new MutationObserver(() => {
    if (!document.getElementById('tr-overlay')) {
      bootstrap();
    }
  });
  currentObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Absolute continuous fallback guarantee
  setInterval(() => {
    safeSendMessage({ action: "heartbeat" });
    safeStorageGet(['domainData'], (data) => {
      if (data && data.domainData && myDomain && data.domainData[myDomain]) {
        evaluateBlockState(data.domainData[myDomain].isBlocked);
      }
    });
  }, 2000);

  if (document.body) {
    bootstrap();
  } else {
    document.addEventListener("DOMContentLoaded", bootstrap);
  }
}

start();
