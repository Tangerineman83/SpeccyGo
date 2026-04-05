document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("speccy-canvas");
    const ctx = canvas.getContext("2d");
    let speccyInstance = null;
    let audioUnlocked = false;

    // --- 1. Immediate Visual Feedback ---
    // Draw directly to the canvas so we don't need to add new HTML/CSS
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00FF00"; // Retro Spectrum Green
    ctx.font = "14px monospace";
    ctx.fillText("SpeccyGo Boot Sequence Initiated...", 10, 20);
    ctx.fillText("Waiting for Z80 Core...", 10, 40);

    // --- 2. Initialize the JSSpeccy Core ---
    if (typeof JSSpeccy !== 'undefined') {
        speccyInstance = new JSSpeccy({
            canvas: canvas,
            machine: '48k',
            zoom: 1,
            border: true,
            autoload: true // Attempts to auto-type LOAD "" if supported by the core version
        });
        ctx.fillText("Z80 Core: OK", 10, 60);
    } else {
        ctx.fillStyle = "#FF0000";
        ctx.fillText("ERROR: jsspeccy.js missing or failed to load.", 10, 60);
        return;
    }

    // --- 3. Dynamic ROM Locator ---
    const defaultRom = "FastFood.tzx";
    const romBasePath = "assets/roms/";
    const urlParams = new URLSearchParams(window.location.search);
    const requestedGame = urlParams.get('game');
    const targetRom = requestedGame ? `${romBasePath}${requestedGame}` : `${romBasePath}${defaultRom}`;

    // --- 4. Fetch and Load the ROM ---
    async function loadGame(romUrl) {
        try {
            ctx.fillText(`Fetching ${romUrl}...`, 10, 80);
            
            const response = await fetch(romUrl);
            if (!response.ok) {
                // Catch 404s or CORS errors explicitly
                throw new Error(`HTTP ${response.status}: Make sure you are using a local web server!`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const romData = new Uint8Array(arrayBuffer);
            
            ctx.fillText("Tape Data Received. Inserting into deck...", 10, 100);
            
            // Give the user a moment to read the UI before handing the canvas to JSSpeccy
            setTimeout(() => {
                speccyInstance.loadTape(romData);
                speccyInstance.tapePlay(); 
                
                // If autoload doesn't trigger the LOAD "" command, remind the user in the console
                console.log("[SpeccyGo] Tape playing. If game does not start, map a button to 'J' then 'Ctrl+P' 'Ctrl+P' to type LOAD \"\"");
            }, 1500);
            
        } catch (error) {
            ctx.fillStyle = "#FF0000";
            ctx.fillText("FETCH ERROR:", 10, 120);
            
            // Text wrapping for the error message
            const words = error.message.split(' ');
            let line = '';
            let y = 140;
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = ctx.measureText(testLine);
                if (metrics.width > canvas.width - 20 && n > 0) {
                    ctx.fillText(line, 10, y);
                    line = words[n] + ' ';
                    y += 20;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, 10, y);
        }
    }

    loadGame(targetRom);

    // --- 5. Audio Context Unlocker ---
    window.addEventListener("touchstart", () => {
        if (!audioUnlocked && speccyInstance.audioContext) {
            speccyInstance.audioContext.resume().then(() => {
                audioUnlocked = true;
            });
        }
    }, { once: true });

    // --- 6. Input Listener & Z80 Memory Injection ---
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;
        
        const { key, state, mode } = e.detail;
        const isPressed = state === 'PRESSED';

        if (mode === "Joystick") {
            speccyInstance.setJoystick('kempston', key, isPressed);
        } else {
            const keyMap = {
                'up': 'Q',
                'down': 'A',
                'left': 'O',
                'right': 'P',
                'fire': 'SPACE'
            };
            const speccyKey = keyMap[key];
            if (speccyKey) speccyInstance.setKeyboard(speccyKey, isPressed);
        }
    });
});
