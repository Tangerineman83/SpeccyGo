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

        // 1. WAKE THE HIJACKED AUDIO CONTEXT
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
            
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.start(0);
            osc.stop(0.001);
        } catch (e) {
            logToScreen("Audio unlock skipped.");
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

    // 2. HYBRID INPUT API
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;

        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // Continuous audio wakeup on every button press
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
        } catch(err) {}

        // --- FIRE BUTTON: Use the proven DOM Event (keyCode: 32) ---
        if (key === 'fire') {
            const kbEvent = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', {
                key: ' ', code: 'Space', bubbles: true, cancelable: true
            });
            Object.defineProperty(kbEvent, 'keyCode', { get: () => 32 });
            Object.defineProperty(kbEvent, 'which', { get: () => 32 });
            
            const container = document.getElementById(viewportId);
            if (container) {
                container.dispatchEvent(kbEvent);
            } else {
                document.dispatchEvent(kbEvent);
            }

            // Fallback: Also ping the internal API using the correct string
            if (typeof speccyInstance.setKeyboard === 'function') {
                speccyInstance.setKeyboard('SPACE', isPressed);
            }
        } 
        // --- D-PAD: Use the direct internal API for Cursor Keys (5,6,7,8) ---
        else {
            const dirMap = {
                'left':  '5',
                'down':  '6',
                'up':    '7',
                'right': '8'
            };
            const targetKey = dirMap[key];
            if (targetKey && typeof speccyInstance.setKeyboard === 'function') {
                speccyInstance.setKeyboard(targetKey, isPressed);
            }
        }
    });
});
