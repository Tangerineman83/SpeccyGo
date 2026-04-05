document.addEventListener("DOMContentLoaded", () => {
    const speccyContainer = document.getElementById("speccy-container");
    const bootScreen = document.getElementById("boot-screen");
    const bootLog = document.getElementById("boot-log");

    // Helper to print directly to the game screen
    function logToScreen(message, isError = false) {
        const span = document.createElement("span");
        span.innerHTML = `<br>> ${message}`;
        if (isError) span.className = "error-text";
        bootLog.appendChild(span);
        console[isError ? 'error' : 'log'](message);
    }

    // 1. FATAL ERROR CHECK: WebAssembly & Fetch require a local server
    if (window.location.protocol === 'file:') {
        logToScreen("FATAL ERROR: Running via file:/// protocol.", true);
        logToScreen("Browsers block WebAssembly and ROM loading from local hard drives.", true);
        logToScreen("Please launch this folder using a local web server (e.g., VS Code Live Server).", true);
        return;
    }

    let speccyInstance = null;
    const defaultRom = "FastFood.tzx";
    const romBasePath = "assets/roms/";
    const urlParams = new URLSearchParams(window.location.search);
    const targetRom = `${romBasePath}${urlParams.get('game') || defaultRom}`;

    logToScreen("Environment OK. Searching for Z80 Engine...");

    // 2. Initialize Engine
    if (typeof JSSpeccy !== 'undefined') {
        try {
            speccyInstance = new JSSpeccy(speccyContainer, {
                machine: 48, 
                border: true,
                autoStart: true,
                autoLoadTapes: true
            });
            logToScreen("JSSpeccy 3 initialized successfully.");
        } catch (e) {
            logToScreen(`Engine Init Failed: ${e.message}`, true);
            return;
        }
    } else {
        logToScreen("ERROR: jsspeccy.js missing or corrupt.", true);
        return;
    }

    // 3. Load ROM with Error Catching
    setTimeout(() => {
        logToScreen(`Fetching Tape: ${targetRom}...`);
        try {
            // Note: openUrl returns a Promise in JSSpeccy 3
            speccyInstance.openUrl(targetRom).then(() => {
                logToScreen("Tape loaded. Hiding boot terminal in 2 seconds...");
                setTimeout(() => { bootScreen.style.display = 'none'; }, 2000);
            }).catch(e => {
                logToScreen(`ROM Fetch Failed: ${e.message}`, true);
                logToScreen("Did you misspell the ROM name or is the file missing?", true);
            });
        } catch (e) {
            logToScreen(`Exception during load: ${e.message}`, true);
        }
    }, 1500);

    // 4. Input Mapping
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;
        const { key, state } = e.detail;
        const isDown = state === 'PRESSED';
        
        const keyMap = { 'up': 'q', 'down': 'a', 'left': 'o', 'right': 'p', 'fire': ' ' };
        const mappedKey = keyMap[key];
        
        if (mappedKey) {
            window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { key: mappedKey, bubbles: true }));
        }
    });
});
