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
            
            // Play a microscopic, silent tone to force iOS hardware lock
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

    // 2. BULLETPROOF INPUT API
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;

        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        // Cursor Joystick maps directly to physical Spectrum number keys
        const keyMap = {
            'left':  '5',
            'down':  '6',
            'up':    '7',
            'right': '8',
            'fire':  '0' 
        };

        const targetKey = keyMap[key];
        
        // Inject directly into the emulator, bypassing the browser's DOM entirely
        if (targetKey && typeof speccyInstance.setKeyboard === 'function') {
            speccyInstance.setKeyboard(targetKey, isPressed);
        }
        
        // Continuous audio wakeup on every button press (iOS safeguard)
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
        } catch(e) {}
    });
});
