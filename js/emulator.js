document.addEventListener("DOMContentLoaded", () => {
    // 1. Prepare the DOM for JSSpeccy 3
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

    // 2. Dynamic ROM Locator
    const defaultRom = "FastFood.tzx";
    const romBasePath = "assets/roms/";
    const urlParams = new URLSearchParams(window.location.search);
    const requestedGame = urlParams.get('game');
    const targetRom = requestedGame ? `${romBasePath}${requestedGame}` : `${romBasePath}${defaultRom}`;

    let speccyInstance = null;

    // 3. Initialize JSSpeccy 3 with Auto-Boot Flags
    if (typeof JSSpeccy !== 'undefined') {
        speccyInstance = new JSSpeccy(speccyContainer, {
            machine: 48, 
            border: true,
            autoStart: true,         // Bypasses the hidden Play button
            autoLoadTapes: true,     // Automatically executes LOAD ""
            openUrl: targetRom       // Ingests the .tzx file on boot
        });
        console.log(`[SpeccyGo] JSSpeccy 3 Engine started. Loading: ${targetRom}`);
    } else {
        speccyContainer.innerHTML = "<p style='color:#00FF00; padding:20px; font-family:monospace;'>ERROR: Z80 Engine missing.<br><br>Please check jsspeccy.js.</p>";
        return;
    }

    // 4. Input Mapping (Synthesizing native keyboard events)
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
