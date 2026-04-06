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
    logToScreen("TAP TO UNMUTE & BOOT.");

    let speccyInstance = null;
    const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

    function startEngine() {
    // 1. Kickstart Web Audio for iOS
    if (window.AudioContext || window.webkitAudioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const tempCtx = new AudioCtx();
        tempCtx.resume(); 
    }

    document.body.removeEventListener("touchstart", startEngine);
    document.body.removeEventListener("click", startEngine);

    logToScreen("Igniting Z80 Engine...");

    try {
        speccyInstance = JSSpeccy(viewportId, {
            'autostart': true,
            'model': '48k'
        });

        // Force engine audio wake-up
        if (speccyInstance.setAudioEnabled) speccyInstance.setAudioEnabled(true);

        logToScreen(`Mounting ${targetRom}...`);
        
        setTimeout(() => {
            speccyInstance.loadFromUrl(targetRom, {'autoload': true});
            // Show the controls once the game starts
            document.getElementById('floating-controller').classList.remove('hidden');
            
            setTimeout(() => {
                bootScreen.style.opacity = "0";
                setTimeout(() => bootScreen.style.display = 'none', 800);
            }, 1500);
        }, 1000);

    } catch (err) {
        logToScreen(`Crash: ${err.message}`, true);
    }
}

    }

    document.body.addEventListener("touchstart", startEngine, { once: true });
    document.body.addEventListener("click", startEngine, { once: true });

    // --- UPDATED INPUT MAPPING (Q, A, O, P, SPACE) ---
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // Traditional Spectrum Mapping: Q=Up, A=Down, O=Left, P=Right, Space=Fire
        const keyMap = {
            'up': 'Q',
            'down': 'A',
            'left': 'O',
            'right': 'P',
            'fire': ' '
        };

        const targetKey = keyMap[key];
        if (targetKey) {
            // v2.2.1 API for direct key state setting
            speccyInstance.setKeyboard(targetKey, isPressed);
        }
    });
});
