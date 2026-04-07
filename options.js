const defaultOptions = {
  configLimitMinutes: 9,
  configResetMinutes: 2,
  targetWebsites: ["youtube.com", "x.com", "twitter.com"]
};

let currentWebsites = [];

function saveOptions() {
  const limitMinutes = parseInt(document.getElementById('limitMinutes').value, 10);
  const resetMinutes = parseInt(document.getElementById('resetMinutes').value, 10);

  const newOptions = {
    configLimitMinutes: isNaN(limitMinutes) ? defaultOptions.configLimitMinutes : Math.max(1, limitMinutes),
    configResetMinutes: isNaN(resetMinutes) ? defaultOptions.configResetMinutes : Math.max(1, resetMinutes),
    targetWebsites: currentWebsites
  };

  chrome.storage.local.set(newOptions, () => {
    const status = document.getElementById('status');
    status.textContent = 'Options saved successfully!';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
}

function restoreOptions() {
  chrome.storage.local.get(
    ['configLimitMinutes', 'configResetMinutes', 'targetWebsites'],
    (items) => {
      document.getElementById('limitMinutes').value = items.configLimitMinutes || defaultOptions.configLimitMinutes;
      document.getElementById('resetMinutes').value = items.configResetMinutes || defaultOptions.configResetMinutes;
      currentWebsites = items.targetWebsites || defaultOptions.targetWebsites;
      renderWebsites();
    }
  );
}

function renderWebsites() {
  const list = document.getElementById('siteList');
  list.innerHTML = '';
  currentWebsites.forEach((site, index) => {
    const li = document.createElement('li');
    li.textContent = site;
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '&#10006;'; // Heavy cross mark
    removeBtn.className = 'remove-btn';
    removeBtn.title = 'Remove site';
    removeBtn.onclick = () => {
      currentWebsites.splice(index, 1);
      renderWebsites();
      saveOptions(); // Auto save on remove
    };
    
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

document.getElementById('addSiteBtn').addEventListener('click', () => {
  const input = document.getElementById('newSite');
  let site = input.value.trim().toLowerCase();
  
  if (site) {
    // Basic formatting: remove http://, https://, and trailing slashes
    site = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    
    if (!currentWebsites.includes(site)) {
      currentWebsites.push(site);
      renderWebsites();
      saveOptions(); // Auto save on add
    }
    input.value = '';
  }
});
