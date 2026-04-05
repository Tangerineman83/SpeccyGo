document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("speccy-canvas");
    let speccyInstance = null;
    let audioUnlocked = false;

    // 1. Initialize the JSSpeccy Core
    if (typeof JSSpeccy !== 'undefined') {
        speccyInstance = new JSSpeccy({
            canvas: canvas,
            machine: '48k',
            zoom: 1,
            border: true
        });
        console.log("[SpeccyGo] JSSpeccy Core Initialized.");
    } else {
        console.error("[SpeccyGo] JSSpeccy core missing.");
        return;
    }

    // 2. Dynamic ROM Locator
    const defaultRom = "FastFood.tzx";
    const romBasePath = "assets/roms/";
    
    // Check the URL for a '?game=' parameter (e.g., mysite.com/?game=Pacman.tzx)
    const urlParams = new URLSearchParams(window.location.search);
    const requestedGame = urlParams.get('game');
    
    // Construct the final path, falling back to the default location if none requested
    const targetRom = requestedGame ? `${romBasePath}${requestedGame}` : `${romBasePath}${defaultRom}`;

    // 3. Fetch and Load the ROM
    async function loadGame(romUrl) {
        try {
            console.log(`[SpeccyGo] Fetching ROM from ${romUrl}...`);
            const response = await fetch(romUrl);
            if (!response.ok) throw new Error(`Network response was not ok for ${romUrl}`);
            
            const arrayBuffer = await response.arrayBuffer();
            const romData = new Uint8Array(arrayBuffer);
            
            speccyInstance.loadTape(romData);
            console.log(`[SpeccyGo] ${romUrl} loaded. Starting autoplay...`);
            speccyInstance.tapePlay(); 
            
        } catch (error) {
            console.error("[SpeccyGo] Error loading ROM:", error);
            // Optional: Draw an error message to the canvas or UI here
        }
    }

    // Trigger the load with our dynamically constructed path
    loadGame(targetRom);

    // 4. Audio Context Unlocker
    window.addEventListener("touchstart", () => {
        if (!audioUnlocked && speccyInstance.audioContext) {
            speccyInstance.audioContext.resume().then(() => {
                audioUnlocked = true;
                console.log("[SpeccyGo] Audio Context Unlocked.");
            });
        }
    }, { once: true });

    // 5. Input Listener & Z80 Memory Injection
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
