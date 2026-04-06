document.addEventListener("DOMContentLoaded", () => {
    const viewportId = 'speccy-container'; 
    const bootScreen = document.getElementById("boot-screen");
    const bootLog = document.getElementById("boot-log");

    function logToScreen(message) {
        if (bootLog) bootLog.innerHTML += `<br>> ${message}`;
    }

    let speccyInstance = null;
    const targetRom = `assets/roms/FastFood.tzx`;

    function startEngine() {
        // 1. CRITICAL: Manual Web Audio Resume for iOS
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            const tempCtx = new AudioCtx();
            tempCtx.resume();
        }

        window.removeEventListener("touchstart", startEngine);
        window.removeEventListener("click", startEngine);

        try {
            logToScreen("Igniting Z80 Engine...");
            
            speccyInstance = JSSpeccy(viewportId, {
                'autostart': true,
                'model': '48k'
            });

            // Force audio permission
            if (speccyInstance.setAudioEnabled) speccyInstance.setAudioEnabled(true);

            setTimeout(() => {
                logToScreen("Mounting Tape...");
                speccyInstance.loadFromUrl(targetRom, {'autoload': true});
                
                // Show controls and hide boot screen
                document.getElementById('floating-controller').classList.remove('hidden');
                bootScreen.style.opacity = "0";
                setTimeout(() => bootScreen.style.display = 'none', 800);
            }, 1000);

        } catch (err) {
            logToScreen("ERROR: " + err.message);
        }
    }

    window.addEventListener("touchstart", startEngine, { once: true });
    window.addEventListener("click", startEngine, { once: true });

    // --- RE-WIRED INPUT LISTENER ---
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // Q=Up, A=Down, O=Left, P=Right, Space=Fire
        const keyMap = {
            'up': 'Q', 'down': 'A', 'left': 'O', 'right': 'P', 'fire': ' '
        };

        const targetKey = keyMap[key];
        if (targetKey) {
            speccyInstance.setKeyboard(targetKey, isPressed);
        }
    });
});
