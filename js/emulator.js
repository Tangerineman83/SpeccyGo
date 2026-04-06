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
            if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
                ctx.resume();
            }
            
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

    // 2. 100% SYNTHETIC DOM INPUT API
    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // Continuous audio wakeup on every button press (Fixes headphone drops!)
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
                ctx.resume();
            }
        } catch(err) {}

        // Map to standard PC Keys (Cursor Joystick numbers + Spacebar)
        const keyMap = {
            'left':  { key: '5', code: 'Digit5', keyCode: 53 },
            'down':  { key: '6', code: 'Digit6', keyCode: 54 },
            'up':    { key: '7', code: 'Digit7', keyCode: 55 },
            'right': { key: '8', code: 'Digit8', keyCode: 56 },
            'fire':  { key: ' ', code: 'Space',  keyCode: 32 }
        };

        const target = keyMap[key];
        
        if (target) {
            // Generate the exact same synthetic event that worked for Q and Space
            const kbEvent = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', {
                key: target.key,
                code: target.code,
                bubbles: true,
                cancelable: true
            });
            
            // Force the exact KeyCode property
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
