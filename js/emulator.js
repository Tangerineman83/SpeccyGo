document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("speccy-canvas");
    let speccyInstance = null;
    let audioUnlocked = false;

    // 1. Initialize the JSSpeccy Core
    // Assuming JSSpeccy is loaded globally via the script tag in index.html
    if (typeof JSSpeccy !== 'undefined') {
        speccyInstance = new JSSpeccy({
            canvas: canvas,
            machine: '48k', // Fast Food runs perfectly on 48k
            zoom: 1,        // CSS handles our scaling
            border: true
        });
        console.log("[SpeccyGo] JSSpeccy Core Initialized.");
    } else {
        console.error("[SpeccyGo] JSSpeccy core missing. Please ensure jsspeccy.js is loaded.");
        return;
    }

    // 2. Fetch and Load the ROM (.tzx file)
    async function loadGame(romUrl) {
        try {
            console.log(`[SpeccyGo] Fetching ROM from ${romUrl}...`);
            const response = await fetch(romUrl);
            if (!response.ok) throw new Error("Network response was not ok");
            
            const arrayBuffer = await response.arrayBuffer();
            const romData = new Uint8Array(arrayBuffer);
            
            // Pass the byte array to the emulator
            speccyInstance.loadTape(romData);
            console.log("[SpeccyGo] Tape loaded. Starting autoplay...");
            speccyInstance.tapePlay(); 
            
        } catch (error) {
            console.error("[SpeccyGo] Error loading ROM:", error);
        }
    }

    // Trigger the load
    loadGame('assets/roms/FastFood.tzx');

    // 3. Audio Context Unlocker (Strict mobile browser policy)
    window.addEventListener("touchstart", () => {
        if (!audioUnlocked && speccyInstance.audioContext) {
            speccyInstance.audioContext.resume().then(() => {
                audioUnlocked = true;
                console.log("[SpeccyGo] Audio Context Unlocked.");
            });
        }
    }, { once: true });

    // 4. Input Listener & Z80 Memory Injection
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;
        
        const { key, state, mode } = e.detail;
        const isPressed = state === 'PRESSED';

        if (mode === "Joystick") {
            // Map directly to Kempston Joystick
            // JSSpeccy usually accepts generic directional strings for Kempston
            speccyInstance.setJoystick('kempston', key, isPressed);
        } else {
            // Map to default Sinclair keyboard equivalents
            const keyMap = {
                'up': 'Q',
                'down': 'A',
                'left': 'O',
                'right': 'P',
                'fire': 'SPACE'
            };
            const speccyKey = keyMap[key];
            if (speccyKey) {
                speccyInstance.setKeyboard(speccyKey, isPressed);
            }
        }
    });
});

