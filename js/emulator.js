window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
});

function bootSpeccyGo() {
    let speccyContainer = document.getElementById("speccy-container");
    let bootScreen = document.getElementById("boot-screen");
    let bootLog = document.getElementById("boot-log");

    // iOS Fullscreen Polyfill
    if (speccyContainer && !speccyContainer.requestFullscreen) {
        speccyContainer.requestFullscreen = speccyContainer.webkitRequestFullscreen || function(){};
    }

    function logToScreen(message, isError = false) {
        if (bootLog) {
            bootLog.innerHTML += `<br><span style="color:${isError ? '#ff3333' : '#0f0'}">> ${message}</span>`;
        }
    }

    try {
        if (window.location.protocol === 'file:') {
            logToScreen("FATAL ERROR: Running via file:/// protocol. Safari blocks WASM.", true);
            return;
        }

        logToScreen("Environment OK. Booting Headless Z80 Engine...");

        let speccyInstance = null;
        const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

        if (typeof JSSpeccy !== 'undefined') {
            
            speccyInstance = JSSpeccy(speccyContainer, {
                machine: 48, 
                border: true,
                uiEnabled: false,
                autoStart: true,         
                autoLoadTapes: true,     
                openUrl: targetRom       
            });
            
            logToScreen(`JSSpeccy 3 started. Loading ${targetRom}...`);
            logToScreen(`If it stalls here, your local server app is blocking the WASM file.`);
            
            // Fade out the boot screen to reveal the game canvas
            setTimeout(() => { 
                if (bootScreen) bootScreen.style.display = 'none'; 
            }, 3000);

        } else {
            logToScreen("FATAL ERROR: jsspeccy.js missing. Did you move it to the root?", true);
            return;
        }

        // Input Mapping
        window.addEventListener("SPECCY_INPUT", (e) => {
            if (!speccyInstance) return;
            const { key, state } = e.detail;
            const keyMap = { 'up': 'q', 'down': 'a', 'left': 'o', 'right': 'p', 'fire': ' ' };
            if (keyMap[key]) {
                window.dispatchEvent(new KeyboardEvent(state === 'PRESSED' ? 'keydown' : 'keyup', { key: keyMap[key], bubbles: true }));
            }
        });

    } catch (err) {
        logToScreen(`Boot Sequence Failed: ${err.message}`, true);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSpeccyGo);
} else {
    bootSpeccyGo();
}
