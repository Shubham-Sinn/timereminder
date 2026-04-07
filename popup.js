function formatTime(ms) {
    const mins = Math.floor(ms / 60000);
    return `${mins}m`;
}

async function render() {
    chrome.runtime.sendMessage({ action: "getPopupData" }, (response) => {
        if (chrome.runtime.lastError || !response) {
            document.getElementById('domains-container').innerHTML = `<div class="loading">Failed to load data.</div>`;
            return;
        }

        const limitMins = response.configLimitMinutes || 9;
        const limitMs = limitMins * 60000;
        const data = response.domainData || {};
        const container = document.getElementById('domains-container');
        
        if (Object.keys(data).length === 0) {
            container.innerHTML = `<div class="loading" style="color:#64748b; text-align:center;">No tracking data available yet. Open a tracked website!</div>`;
            return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            let activeUrl = tabs && tabs.length > 0 ? tabs[0].url : "";
            
            let sortedDomains = Object.keys(data).sort((a, b) => {
                let aActive = activeUrl.includes(a);
                let bActive = activeUrl.includes(b);
                if (aActive && !bActive) return -1;
                if (!aActive && bActive) return 1;
                return a.localeCompare(b);
            });

            container.innerHTML = '';
            for (const domain of sortedDomains) {
                const stats = data[domain];
            const card = document.createElement('div');
            card.className = 'domain-card';

            const accumulated = stats.accumulatedMs || 0;
            const unlockCount = stats.unlockCount || 0;
            let fraction = Math.min(1, accumulated / limitMs);
            let isBlocked = stats.isBlocked || fraction >= 1;
            let displayAccumulated = Math.min(accumulated, limitMs);
            let timeText = `${formatTime(displayAccumulated)} / ${limitMins}m`;

            if (response.activeDomain === domain && response.unlockPercentage !== undefined) {
                isBlocked = false;
                fraction = response.unlockPercentage;
                timeText = `${Math.floor(fraction * limitMins)}m / ${limitMins}m (Unlocked)`;
            }
            
            const pClass = isBlocked ? 'progress-bar blocked' : 'progress-bar';

            card.innerHTML = `
                <div class="domain-header">
                    <div class="domain-name">${domain}</div>
                    <div class="domain-time" style="color: ${isBlocked ? '#ef4444' : '#94a3b8'}">${timeText}</div>
                </div>
                <div class="progress-container">
                    <div class="${pClass}" style="width: ${fraction * 100}%"></div>
                </div>
                <div class="domain-footer">
                    <div class="total-time">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Total <span>${formatTime(accumulated)}</span>
                    </div>
                    <div class="unlock-count">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        Unlocked <span>${unlockCount}</span> times
                    </div>
                </div>
            `;
            container.appendChild(card);
        }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    render();
    setInterval(render, 1000); // 1-second auto-update visually
});
