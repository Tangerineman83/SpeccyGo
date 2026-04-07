window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
});

document.addEventListener("DOMContentLoaded", () => {
    const viewportId = 'speccy-container'; 
    const bootScreen = document.getElementById("boot-screen");
    const bootLog = document.getElementById("boot-log");
    const libraryMenu = document.getElementById("library-menu");

    function logToScreen(message) {
        if (bootLog) bootLog.innerHTML += `<br>> ${message}`;
    }

    let speccyInstance = null;
    let targetRom = ""; // This is now set by the menu

    function startEngine() {
        // WAKE THE AUDIO
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume();
            const osc = ctx.createOscillator(); osc.connect(ctx.destination);
            osc.start(0); osc.stop(0.001);
        } catch (e) { logToScreen("Audio unlock skipped."); }

        try {
            logToScreen("Igniting Z80 Engine...");
            speccyInstance = JSSpeccy(viewportId, { 'autostart': true, 'model': '48k' });

            if (speccyInstance.setAudioEnabled) speccyInstance.setAudioEnabled(true);

            setTimeout(() => {
                logToScreen(`Mounting ${targetRom}...`);
                speccyInstance.loadFromUrl(targetRom, {'autoload': true});
                
                document.getElementById('floating-controller').classList.remove('hidden');
                bootScreen.style.opacity = "0";
                setTimeout(() => bootScreen.style.display = 'none', 800);
            }, 1000);

        } catch (err) {
            logToScreen("ERROR: " + err.message);
        }
    }

    // --- ROM LIBRARY BINDING ---
    const romButtons = document.querySelectorAll('.rom-btn');
    romButtons.forEach(btn => {
        const triggerRom = (e) => {
            e.preventDefault();
            // 1. Grab the specific file name
            targetRom = `assets/roms/${btn.getAttribute('data-rom')}`;
            // 2. Hide the menu
            libraryMenu.classList.add('hidden');
            // 3. Boot the engine (button tap acts as audio unlock)
            startEngine(); 
        };
        
        btn.addEventListener('touchstart', triggerRom, { passive: false });
        btn.addEventListener('mousedown', triggerRom);
    });

    // --- DIZZY Z-X-K-M CONTROLS ---
    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');

        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume();
        } catch(err) {}

        const keyMap = {
            'left':  { key: 'Z', code: 'KeyZ', keyCode: 90 },
            'right': { key: 'X', code: 'KeyX', keyCode: 88 },
            'up':    { key: 'K', code: 'KeyK', keyCode: 75 },
            'down':  { key: 'M', code: 'KeyM', keyCode: 77 },
            'fire':  { key: ' ', code: 'Space', keyCode: 32 }
        };

        const target = keyMap[key];
        if (target) {
            const kbEvent = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', {
                key: target.key, code: target.code, bubbles: true, cancelable: true
            });
            Object.defineProperty(kbEvent, 'keyCode', { get: () => target.keyCode });
            Object.defineProperty(kbEvent, 'which', { get: () => target.keyCode });
            
            const container = document.getElementById(viewportId);
            if (container) container.dispatchEvent(kbEvent);
            else document.dispatchEvent(kbEvent);
        }
    });
});
