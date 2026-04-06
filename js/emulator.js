// 1. Intercept WebKit AudioContext to capture JSSpeccy's exact audio engine
let jsspeccyAudioCtx = null;
const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
if (OriginalAudioContext) {
    window.AudioContext = function() {
        jsspeccyAudioCtx = new OriginalAudioContext();
        return jsspeccyAudioCtx;
    };
    window.webkitAudioContext = window.AudioContext;
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
    const targetRom = `assets/roms/FastFood.tzx`;

    function startEngine() {
        // 2. Unlock the exact context JSSpeccy created
        if (jsspeccyAudioCtx && jsspeccyAudioCtx.state === 'suspended') {
            jsspeccyAudioCtx.resume();
        }

        window.removeEventListener("touchstart", startEngine);
        window.removeEventListener("click", startEngine);

        try {
            logToScreen("Igniting Z80 Engine...");
            speccyInstance = JSSpeccy(viewportId, { 'autostart': true, 'model': '48k' });

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

    // 3. Dispatch real DOM Keyboard Events (Bulletproof Input)
    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // Q=81, A=65, O=79, P=80, Space=32
        const keyCodeMap = { 'up': 81, 'down': 65, 'left': 79, 'right': 80, 'fire': 32 };
        const strMap = { 'up': 'q', 'down': 'a', 'left': 'o', 'right': 'p', 'fire': ' ' };

        const keyCode = keyCodeMap[key];
        if (keyCode) {
            document.dispatchEvent(new KeyboardEvent(isPressed ? 'keydown' : 'keyup', {
                key: strMap[key],
                code: key === 'fire' ? 'Space' : 'Key' + strMap[key].toUpperCase(),
                keyCode: keyCode,
                which: keyCode,
                bubbles: true
            }));
        }
    });
});
