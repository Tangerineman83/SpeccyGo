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
    let targetRom = ""; 

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
                logToScreen(`Mounting Tape Data...`);
                speccyInstance.loadFromUrl(targetRom, {'autoload': true});
                
                document.getElementById('floating-controller').classList.remove('hidden');
                bootScreen.style.opacity = "0";
                setTimeout(() => bootScreen.style.display = 'none', 800);
            }, 1000);

        } catch (err) {
            logToScreen("ERROR: " + err.message);
        }
    }

    // --- 1. BUILT-IN ROM BINDING ---
    const romButtons = document.querySelectorAll('.rom-btn[data-rom]');
    romButtons.forEach(btn => {
        const triggerRom = (e) => {
            e.preventDefault();
            targetRom = `assets/roms/${btn.getAttribute('data-rom')}`;
            libraryMenu.classList.add('hidden');
            startEngine(); 
        };
        btn.addEventListener('touchstart', triggerRom, { passive: false });
        btn.addEventListener('mousedown', triggerRom);
    });

    // --- 2. CUSTOM DEVICE ROM BINDING ---
    const customRomBtn = document.getElementById('btn-custom-rom');
    const fileInput = document.getElementById('rom-upload');

    if (customRomBtn && fileInput) {
        // Click the hidden file input when the green button is pressed
        const triggerPicker = (e) => {
            e.preventDefault();
            fileInput.click(); 
        };
        customRomBtn.addEventListener('touchstart', triggerPicker, { passive: false });
        customRomBtn.addEventListener('mousedown', triggerPicker);

        // When a file is selected, convert it and load it
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Create a temporary URL from the user's local file
                targetRom = URL.createObjectURL(file);
                libraryMenu.classList.add('hidden');
                startEngine();
            }
        });
    }

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
