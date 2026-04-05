document.addEventListener("DOMContentLoaded", () => {
    // 1. Prepare the DOM for JSSpeccy 3 (It requires a container div, not a canvas)
    const oldCanvas = document.getElementById("speccy-canvas");
    const speccyContainer = document.createElement("div");
    speccyContainer.id = "speccy-container";
    speccyContainer.style.width = "100%";
    speccyContainer.style.maxWidth = "800px";
    speccyContainer.style.aspectRatio = "4/3";
    speccyContainer.style.border = "2px solid #333";
    speccyContainer.style.backgroundColor = "#000";
    
    // Swap the canvas for the div without touching index.html
    oldCanvas.parentNode.replaceChild(speccyContainer, oldCanvas);

    let speccyInstance = null;

    // 2. Initialize the JSSpeccy 3 Core
    if (typeof JSSpeccy !== 'undefined') {
        speccyInstance = new JSSpeccy(speccyContainer, {
            machine: 48, 
            border: true
        });
        console.log("[SpeccyGo] JSSpeccy 3 Core Initialized.");
    } else {
        speccyContainer.innerHTML = "<p style='color:#00FF00; padding:20px; font-family:monospace;'>ERROR: Z80 Engine missing.<br><br>Please download jsspeccy-3.2.zip and place jsspeccy.js and jsspeccy.wasm in the js/ folder.</p>";
        return;
    }

    // 3. Dynamic ROM Locator
    const defaultRom = "FastFood.tzx";
    const romBasePath = "assets/roms/";
    const urlParams = new URLSearchParams(window.location.search);
    const requestedGame = urlParams.get('game');
    const targetRom = requestedGame ? `${romBasePath}${requestedGame}` : `${romBasePath}${defaultRom}`;

    // 4. Load the ROM using JSSpeccy 3's native URL fetcher
    setTimeout(() => {
        console.log(`[SpeccyGo] Tape inserting: ${targetRom}`);
        try {
            speccyInstance.openUrl(targetRom); 
        } catch (e) {
            console.error("ROM Load Failed. Are you running a local web server?", e);
        }
    }, 1000);

    // 5. Input Mapping (Synthesizing native keyboard events for JSSpeccy)
    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isDown = state === 'PRESSED';
        const eventType = isDown ? 'keydown' : 'keyup';

        // Map D-pad and Fire to default Sinclair keyboard controls (QAOP + Space)
        const keyMap = {
            'up': 'q',
            'down': 'a',
            'left': 'o',
            'right': 'p',
            'fire': ' '
        };
        
        const mappedKey = keyMap[key];
        if (mappedKey) {
            window.dispatchEvent(new KeyboardEvent(eventType, { key: mappedKey, bubbles: true }));
        }
    });
});
