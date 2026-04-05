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

    if (window.location.protocol === 'file:') {
        logToScreen("FATAL ERROR: Running via file:/// protocol. Safari blocks WASM.", true);
        return;
    }

    logToScreen("BIOS Loaded. System Diagnostics OK.");
    logToScreen("Z80 Engine ready in standby mode.");

    // Add the interactive Tap-to-Start UI
    const startPrompt = document.createElement("div");
    startPrompt.innerHTML = "INSERT COIN<br><br>(TAP SCREEN TO BOOT)";
    startPrompt.className = "blink-prompt";
    bootLog.appendChild(startPrompt);

    let speccyInstance = null;
    const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

    // THE FIX: Defer engine creation until Safari registers a user gesture
    function startEngine() {
        // Prevent double-firing
        document.body.removeEventListener("touchstart", startEngine);
        document.body.removeEventListener("click", startEngine);

        startPrompt.innerHTML = "BOOTING...";
        startPrompt.style.animation = "none";
        startPrompt.style.color = "#0f0";

        try {
            // Because this is inside a click/touch event, Safari grants full AutoPlay and WASM rights
            speccyInstance = JSSpeccy(speccyContainer, {
                machine: 48, 
                border: true,
                uiEnabled: false,
                autoStart: true,         
                autoLoadTapes: true,     
                openUrl: targetRom       
            });
            
            logToScreen(`Mounting ${targetRom}...`);
            
            // Fade out the boot screen to reveal the running game
            setTimeout(() => { 
                if (bootScreen) {
                    bootScreen.style.transition = "opacity 0.5s ease";
                    bootScreen.style.opacity = "0";
                    setTimeout(() => bootScreen.style.display = 'none', 500);
                }
            }, 1500);

        } catch (err) {
            logToScreen(`Crash: ${err.message}`, true);
        }
    }

    // Listen for the first physical gesture to unlock the browser restrictions
    document.body.addEventListener("touchstart", startEngine, { once: true });
    document.body.addEventListener("click", startEngine, { once: true });

    // Input Mapping
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;
        const { key, state } = e.detail;
        const keyMap = { 'up': 'q', 'down': 'a', 'left': 'o', 'right': 'p', 'fire': ' ' };
        if (keyMap[key]) {
            window.dispatchEvent(new KeyboardEvent(state === 'PRESSED' ? 'keydown' : 'keyup', { key: keyMap[key], bubbles: true }));
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSpeccyGo);
} else {
    bootSpeccyGo();
}
