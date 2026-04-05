window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
    console.error("[SpeccyGo Crash]", e.message);
});

function bootSpeccyGo() {
    let speccyContainer = document.getElementById("speccy-container");
    let bootScreen = document.getElementById("boot-screen");
    let bootLog = document.getElementById("boot-log");

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

        logToScreen("Environment OK. Booting Headless Z80 Engine...");

        let speccyInstance = null;
        const defaultRom = "FastFood.tzx";
        const romBasePath = "assets/roms/";
        const urlParams = new URLSearchParams(window.location.search);
        const targetRom = `${romBasePath}${urlParams.get('game') || defaultRom}`;

        if (typeof JSSpeccy !== 'undefined') {
            
            // Initialize with UI disabled and native URL loading
            speccyInstance = JSSpeccy(speccyContainer, {
                machine: 48, 
                border: true,
                uiEnabled: false,        // Kills the "App within an App" menus
                autoStart: true,         // Bypasses play button
                autoLoadTapes: true,     // Auto-types LOAD ""
                openUrl: targetRom       // Ingests ROM cleanly on worker boot
            });
            
            logToScreen(`JSSpeccy 3 started. Ingesting ${targetRom}...`);
            
            // Clear the boot screen after giving the engine time to launch
            setTimeout(() => { 
                if (bootScreen) bootScreen.style.display = 'none'; 
            }, 2500);

        } else {
            logToScreen("ERROR: jsspeccy.js missing or corrupt.", true);
            return;
        }

        // Input Mapping - Synthesize native keypresses from the virtual D-Pad
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSpeccyGo);
} else {
    bootSpeccyGo();
}
