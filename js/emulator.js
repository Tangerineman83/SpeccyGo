// 1. THE AUDIO HIJACK: Intercept the Audio Engine
let sharedAudioCtx = null;
const NativeAudioContext = window.AudioContext || window.webkitAudioContext;

if (NativeAudioContext) {
    window.AudioContext = window.webkitAudioContext = function() {
        if (!sharedAudioCtx) {
            sharedAudioCtx = new NativeAudioContext();
        }
        return sharedAudioCtx;
    };
}

window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
});

document.addEventListener("DOMContentLoaded", () => {
    const viewportId = 'speccy-container'; 
    const bootScreen = document.getElementById("boot-screen");
    const bootLog = document.getElementById("boot-log");

    function logToScreen(message) {
        if (bootLog) bootLog.innerHTML += `<br>> ${message}`;
    }

    let speccyInstance = null;
    const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

    function startEngine() {
        window.removeEventListener("touchstart", startEngine);
        window.removeEventListener("click", startEngine);

        // Initial Audio Wakeup Attempt
        if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
            sharedAudioCtx.resume().catch(() => {});
        }

        try {
            logToScreen("Igniting Z80 Engine...");
            speccyInstance = JSSpeccy(viewportId, { 'autostart': true, 'model': '48k' });

            if (speccyInstance.setAudioEnabled) speccyInstance.setAudioEnabled(true);

            setTimeout(() => {
                logToScreen("Mounting Tape...");
                speccyInstance.loadFromUrl(targetRom, {'autoload': true});
                
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

    // 2. THE INPUT FIX & CONTINUOUS AUDIO UNLOCK
    window.addEventListener("SPECCY_INPUT", (e) => {
        // --- CONTINUOUS AUDIO UNLOCK ---
        // Every button press forces iOS to evaluate the audio state
        if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
            sharedAudioCtx.resume().catch(() => {});
        }
        if (speccyInstance && speccyInstance.setAudioEnabled) {
            speccyInstance.setAudioEnabled(true);
        }

        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // --- ARROW KEY MAPPING WITH SAFARI POLYFILL ---
        const keyMap = {
            'up': { code: 'ArrowUp', keyCode: 38 },
            'down': { code: 'ArrowDown', keyCode: 40 },
            'left': { code: 'ArrowLeft', keyCode: 37 },
            'right': { code: 'ArrowRight', keyCode: 39 },
            'fire': { code: 'Space', keyCode: 32 }
        };

        const target = keyMap[key];
        if (target) {
            const kbEvent = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', {
                key: target.code,
                code: target.code,
                bubbles: true,
                cancelable: true
            });
            
            // Force Safari to respect the correct hardware KeyCodes
            Object.defineProperty(kbEvent, 'keyCode', { get: () => target.keyCode });
            Object.defineProperty(kbEvent, 'which', { get: () => target.keyCode });
            
            const container = document.getElementById(viewportId);
            if (container) {
                container.dispatchEvent(kbEvent);
            } else {
                document.dispatchEvent(kbEvent);
            }
        }
    });
});
