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
        logToScreen("FATAL ERROR: Running via file:/// protocol.", true);
        return;
    }

    let speccyInstance = null;
    const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

    try {
        logToScreen("BIOS Loaded. Initializing Z80 Engine...");

        // 1. Initialize immediately WITHOUT the ROM.
        // Safari will block the async audio and force the native Play button to appear.
        speccyInstance = JSSpeccy(speccyContainer, {
            machine: 48, 
            border: true,
            uiEnabled: false,
            autoStart: true,         
            autoLoadTapes: true
        });

        logToScreen("Engine compiled. Waiting for user to unlock audio...");
        
        // Hide our green boot terminal after a moment so the user can clearly see and click the Play button
        setTimeout(() => {
            if (bootScreen) {
                bootScreen.style.transition = "opacity 0.5s ease";
                bootScreen.style.opacity = "0";
                setTimeout(() => bootScreen.style.display = 'none', 500);
            }
        }, 1500);

        // 2. Intercept the user's tap on the Play button
        speccyContainer.addEventListener("click", () => {
            if (!window.romMounted) {
                window.romMounted = true;
                
                // DIAGNOSTIC 1: Did the click actually register?
                logToScreen("Play Button Clicked! Event listener active.", false);
                bootScreen.style.display = 'flex'; // Force boot screen to stay visible
                bootScreen.style.opacity = '1';
                
                logToScreen("Waiting 4 seconds for Z80 to reach BASIC prompt...");

                // DIAGNOSTIC 2: Eliminate the CPU boot race condition
                setTimeout(() => {
                    try {
                        logToScreen(`Attempting to mount ${targetRom} now...`, false);
                        speccyInstance.openUrl(targetRom);
                        
                        setTimeout(() => {
                            logToScreen("Tape command sent. Hiding boot screen.", false);
                            bootScreen.style.display = 'none';
                        }, 1000);
                        
                    } catch (e) {
                        logToScreen(`Tape mount failed: ${e.message}`, true);
                    }
                }, 4000); // Massive 4 second delay
            }
        }, { capture: true }); // 'capture: true' forces our listener to fire BEFORE JSSpeccy can swallow it


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
        logToScreen(`Crash: ${err.message}`, true);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSpeccyGo);
} else {
    bootSpeccyGo();
}
