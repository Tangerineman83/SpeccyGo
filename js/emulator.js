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
        window.removeEventListener("touchstart", startEngine);
        window.removeEventListener("click", startEngine);

        // 1. THE iOS AUDIO UNLOCKER (Silent Oscillator Trick)
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                const unlockCtx = new AudioCtx();
                const osc = unlockCtx.createOscillator();
                osc.connect(unlockCtx.destination);
                osc.start(0);
                osc.stop(0.001); // Play a silent sound for 1 millisecond
                if (unlockCtx.state === 'suspended') unlockCtx.resume();
            }
        } catch (e) {
            logToScreen("Audio bypass skipped.");
        }

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

    // 2. THE INPUT FIX: Standard PC Arrow Keys (Kempston Joystick)
    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // Map to standard browser Arrow Keys (JSSpeccy reads these as Kempston Joystick)
        const keyMap = {
            'up': { code: 'ArrowUp', keyCode: 38 },
            'down': { code: 'ArrowDown', keyCode: 40 },
            'left': { code: 'ArrowLeft', keyCode: 37 },
            'right': { code: 'ArrowRight', keyCode: 39 },
            'fire': { code: 'Space', keyCode: 32 }
        };

        const target = keyMap[key];
        if (target) {
            document.dispatchEvent(new KeyboardEvent(isPressed ? 'keydown' : 'keyup', {
                key: target.code,
                code: target.code,
                keyCode: target.keyCode,
                which: target.keyCode,
                bubbles: true
            }));
        }
    });
});
