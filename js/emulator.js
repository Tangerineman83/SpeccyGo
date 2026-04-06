// 1. THE AUDIO HIJACK: Intercept the browser's Audio engine
let sharedAudioCtx = null;
const NativeAudioContext = window.AudioContext || window.webkitAudioContext;

if (NativeAudioContext) {
    // Override the global object so JSSpeccy uses OUR unlocked instance
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

        // 2. THE AUDIO UNLOCK: Done directly inside the physical tap event
        if (NativeAudioContext) {
            if (!sharedAudioCtx) sharedAudioCtx = new NativeAudioContext();
            if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
            
            // Fire a microscopic, silent tone to permanently wake iOS WebKit Audio
            const osc = sharedAudioCtx.createOscillator();
            osc.connect(sharedAudioCtx.destination);
            osc.start(0);
            osc.stop(0.001);
        }

        try {
            logToScreen("Igniting Z80 Engine...");
            speccyInstance = JSSpeccy(viewportId, { 'autostart': true, 'model': '48k' });

            // Ensure the emulator knows audio is active
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

    // 3. THE INPUT FIX: Hardcoded Q-A-O-P with Safari Polyfill
    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // ASCII KeyCodes: Q=81, A=65, O=79, P=80, Space=32
        const keyMap = {
            'up': 81,   
            'down': 65,  
            'left': 79,  
            'right': 80, 
            'fire': 32   
        };

        const targetKeyCode = keyMap[key];
        if (targetKeyCode) {
            const kbEvent = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', {
                bubbles: true,
                cancelable: true,
                keyCode: targetKeyCode,
                which: targetKeyCode
            });
            
            // CRITICAL: Safari ignores keyCode in the constructor. We must force it.
            Object.defineProperty(kbEvent, 'keyCode', { get: () => targetKeyCode });
            Object.defineProperty(kbEvent, 'which', { get: () => targetKeyCode });
            
            // Dispatch directly to the engine container
            const container = document.getElementById(viewportId);
            if (container) {
                container.dispatchEvent(kbEvent);
            } else {
                document.dispatchEvent(kbEvent);
            }
        }
    });
});
