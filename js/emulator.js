// --- 1. AGGRESSIVE ON-SCREEN DEBUGGER ---
const debugOverlay = document.createElement("div");
debugOverlay.style.cssText = "position:absolute; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); color:#0f0; font-family:monospace; font-size:12px; padding:20px; z-index:9999; overflow-y:auto; box-sizing:border-box; pointer-events:none;";
document.body.appendChild(debugOverlay);

function debugLog(message, isError = false) {
    console[isError ? 'error' : 'log'](message);
    const color = isError ? '#ff3333' : '#0f0';
    debugOverlay.innerHTML += `<div style="color:${color}; margin-bottom:4px;">> ${message}</div>`;
    debugOverlay.scrollTop = debugOverlay.scrollHeight; // Auto-scroll
}

// Trap 1: Global JS Errors
window.addEventListener("error", function(e) {
    debugLog(`SYSTEM HALT: ${e.message} at ${e.filename}:${e.lineno}`, true);
});

// Trap 2: Silent Background Worker Crashes
window.addEventListener("unhandledrejection", function(e) {
    debugLog(`PROMISE HALT: ${e.reason}`, true);
});

// Trap 3: Intercept all Network Requests (to watch the .wasm and .tzx files load)
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    debugLog(`NET: Fetching ${url.split('/').pop()}...`);
    try {
        const response = await originalFetch.apply(this, args);
        if (!response.ok) debugLog(`NET: HTTP Error ${response.status} on ${url}`, true);
        else debugLog(`NET: ${url.split('/').pop()} loaded successfully.`);
        return response;
    } catch (e) {
        debugLog(`NET: Network fail on ${url}: ${e.message}`, true);
        throw e;
    }
};

function bootSpeccyGo() {
    let speccyContainer = document.getElementById("speccy-container");
    
    if (!speccyContainer) {
        const oldCanvas = document.getElementById("speccy-canvas");
        speccyContainer = document.createElement("div");
        speccyContainer.id = "speccy-container";
        speccyContainer.style.cssText = "position:absolute; top:0; left:0; width:100vw; height:100vh; background:#000; display:flex; justify-content:center; align-items:center; z-index:1;";
        if (oldCanvas && oldCanvas.parentNode) oldCanvas.parentNode.replaceChild(speccyContainer, oldCanvas);
    }

    // iOS Fullscreen Polyfill
    if (!speccyContainer.requestFullscreen) {
        speccyContainer.requestFullscreen = speccyContainer.webkitRequestFullscreen || function(){};
    }

    try {
        if (window.location.protocol === 'file:') {
            debugLog("FATAL: Running via file:// protocol. Safari strictly blocks WASM.", true);
            return;
        }

        debugLog("INIT: Environment OK. Booting Headless Z80 Engine...");

        let speccyInstance = null;
        const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

        if (typeof JSSpeccy !== 'undefined') {
            debugLog("INIT: Instantiating JSSpeccy Factory...");
            
            speccyInstance = JSSpeccy(speccyContainer, {
                machine: 48, 
                border: true,
                uiEnabled: false,
                autoStart: true,         
                autoLoadTapes: true,     
                openUrl: targetRom       
            });
            
            debugLog("INIT: Engine configured. Waiting for WebWorker & WASM compilation...");
            
        } else {
            debugLog("FATAL: jsspeccy.js missing or corrupt.", true);
            return;
        }

        // Add a tap-to-dismiss feature to the debug console once we confirm it works
        window.addEventListener("touchstart", () => {
            if (debugOverlay.style.opacity !== "0") {
                debugOverlay.style.opacity = "0";
                debugLog("UI: Debug console hidden by user tap.");
            }
        }, { once: true });

        // Standard Input Mapping
        window.addEventListener("SPECCY_INPUT", (e) => {
            if (!speccyInstance) return;
            const { key, state } = e.detail;
            const keyMap = { 'up': 'q', 'down': 'a', 'left': 'o', 'right': 'p', 'fire': ' ' };
            if (keyMap[key]) {
                window.dispatchEvent(new KeyboardEvent(state === 'PRESSED' ? 'keydown' : 'keyup', { key: keyMap[key], bubbles: true }));
            }
        });

    } catch (err) {
        debugLog(`BOOT SEQ FAIL: ${err.message}`, true);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSpeccyGo);
} else {
    bootSpeccyGo();
}
