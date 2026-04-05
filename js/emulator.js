// Global Error Catcher - Forces any hidden JS crashes onto the screen
window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
    console.error("[SpeccyGo Crash]", e.message);
});

function bootSpeccyGo() {
    let speccyContainer = document.getElementById("speccy-container");
    let bootScreen = document.getElementById("boot-screen");
    let bootLog = document.getElementById("boot-log");

    // Defensive DOM check
    if (!speccyContainer) {
        const oldCanvas = document.getElementById("speccy-canvas");
        speccyContainer = document.createElement("div");
        speccyContainer.id = "speccy-container";
        speccyContainer.style.cssText = "width:100%; max-width:800px; aspect-ratio:4/3; border:2px solid #333; background:#000;";
        if (oldCanvas && oldCanvas.parentNode) {
            oldCanvas.parentNode.replaceChild(speccyContainer, oldCanvas);
        }
    }

    // Logging helper
    function logToScreen(message, isError = false) {
        console[isError ? 'error' : 'log'](message);
        if (bootLog) {
            bootLog.innerHTML += `<br><span style="color:${isError ? '#ff3333' : '#0f0'}">> ${message}</span>`;
        }
    }

    try {
        if (window.location.protocol === 'file:') {
            logToScreen("FATAL ERROR: Running via file:/// protocol.", true);
            logToScreen("Browsers block WebAssembly from local hard drives.", true);
            logToScreen("Please launch this folder using a local web server.", true);
            return;
        }

        logToScreen("Environment OK. Searching for Z80 Engine...");

        let speccyInstance = null;
        const defaultRom = "FastFood.tzx";
        const romBasePath = "assets/roms/";
        const urlParams = new URLSearchParams(window.location.search);
        const targetRom = `${romBasePath}${urlParams.get('game') || defaultRom}`;

        if (typeof JSSpeccy !== 'undefined') {
            
            // FIX: Removed the 'new' keyword. JSSpeccy 3 is a factory function!
            speccyInstance = JSSpeccy(speccyContainer, {
                machine: 48, 
                border: true,
                autoStart: true,
                autoLoadTapes: true
            });
            logToScreen("JSSpeccy 3 initialized successfully.");
            
        } else {
            logToScreen("ERROR: jsspeccy.js missing or corrupt.", true);
            return;
        }

        // Delay tape loading slightly to ensure Worker is ready
        setTimeout(() => {
            logToScreen(`Fetching Tape: ${targetRom}...`);
            if (speccyInstance.openUrl) {
                speccyInstance.openUrl(targetRom).then(() => {
                    logToScreen("Tape loaded. Hiding boot terminal in 2 seconds...");
                    setTimeout(() => { if (bootScreen) bootScreen.style.display = 'none'; }, 2000);
                }).catch(e => {
                    logToScreen(`ROM Fetch Failed: ${e.message}`, true);
                    logToScreen("Check if the ROM name is correct and server is running.", true);
                });
            } else {
                logToScreen("ERROR: Engine does not support openUrl.", true);
            }
        }, 1500);

        // Input Mapping
        window.addEventListener("SPECCY_INPUT", (e) => {
            if (!speccyInstance) return;
            const { key, state } = e.detail;
            const isDown = state === 'PRESSED';
            const keyMap = { 'up': 'q', 'down': 'a', 'left': 'o', 'right': 'p', 'fire': ' ' };
            const mappedKey = keyMap[key];
            
            if (mappedKey) {
                window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { key: mappedKey, bubbles: true }));
            }
        });

    } catch (err) {
        logToScreen(`Boot Sequence Failed: ${err.message}`, true);
    }
}

// Ensure the DOM is fully loaded before executing
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSpeccyGo);
} else {
    bootSpeccyGo();
}
