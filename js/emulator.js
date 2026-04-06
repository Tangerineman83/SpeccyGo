window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
});

document.addEventListener("DOMContentLoaded", () => {
    const viewportId = 'speccy-container'; 
    const bootScreen = document.getElementById("boot-screen");
    const bootLog = document.getElementById("boot-log");

    function logToScreen(message, isError = false) {
        if (bootLog) {
            bootLog.innerHTML += `<br><span style="color:${isError ? '#ff3333' : '#0f0'}">> ${message}</span>`;
        }
    }

    logToScreen("BIOS v2.2.1 Standby.");
    logToScreen("TAP ANYWHERE TO BOOT.");

    let speccyInstance = null;
    const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

    function startEngine() {
        // Remove listeners immediately to prevent double-booting
        window.removeEventListener("touchstart", startEngine);
        window.removeEventListener("click", startEngine);

        logToScreen("Igniting Z80 Engine...");

        try {
            // Initialize the engine
            speccyInstance = JSSpeccy(viewportId, {
                'autostart': true,
                'model': '48k'
            });

            // Force the AudioContext to resume (iOS specific requirement)
            if (speccyInstance.setAudioEnabled) {
                speccyInstance.setAudioEnabled(true);
            }

            logToScreen(`Mounting ${targetRom}...`);
            
            setTimeout(() => {
                speccyInstance.loadFromUrl(targetRom, {'autoload': true});
                
                // Show the controls and hide boot screen
                document.getElementById('floating-controller').classList.remove('hidden');
                
                setTimeout(() => {
                    bootScreen.style.transition = "opacity 0.8s ease";
                    bootScreen.style.opacity = "0";
                    setTimeout(() => bootScreen.style.display = 'none', 800);
                }, 1500);
            }, 1000);

        } catch (err) {
            logToScreen(`Crash: ${err.message}`, true);
        }
    }

    // Attach to window to ensure the hit-area covers the whole screen
    window.addEventListener("touchstart", startEngine, { once: true });
    window.addEventListener("click", startEngine, { once: true });

    // Input Listener for Q, A, O, P, Space
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        const keyMap = {
            'up': 'Q',
            'down': 'A',
            'left': 'O',
            'right': 'P',
            'fire': ' '  // Space bar
        };

        const targetKey = keyMap[key];
        if (targetKey) {
            speccyInstance.setKeyboard(targetKey, isPressed);
        }
    });
});
