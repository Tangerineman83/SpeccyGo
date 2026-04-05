window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
});

document.addEventListener("DOMContentLoaded", () => {
    let canvas = document.getElementById("speccy-canvas");
    let bootScreen = document.getElementById("boot-screen");
    let bootLog = document.getElementById("boot-log");

    function logToScreen(message, isError = false) {
        if (bootLog) {
            bootLog.innerHTML += `<br><span style="color:${isError ? '#ff3333' : '#0f0'}">> ${message}</span>`;
        }
    }

    logToScreen("BIOS Loaded. Pure JS Engine standing by.");
    logToScreen("TAP SCREEN TO BOOT.", false);

    let speccyInstance = null;
    const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

    function startEngine() {
        // Prevent double booting
        document.body.removeEventListener("touchstart", startEngine);
        document.body.removeEventListener("click", startEngine);

        logToScreen("Compiling Engine...");

        try {
            // 1. Boot the pure JS engine synchronously
            speccyInstance = new JSSpeccy({
                canvas: canvas,
                machine: '48k',
                zoom: 1,
                border: true,
                autoload: true 
            });

            // 2. Fetch the tape as an ArrayBuffer and inject it
            logToScreen(`Fetching ${targetRom}...`);
            fetch(targetRom)
                .then(response => {
                    if (!response.ok) throw new Error("ROM not found on server.");
                    return response.arrayBuffer();
                })
                .then(buffer => {
                    speccyInstance.loadTape(new Uint8Array(buffer));
                    speccyInstance.tapePlay();
                    
                    logToScreen("Tape injected. Enjoy the game!");
                    
                    // Fade out boot screen
                    setTimeout(() => {
                        bootScreen.style.transition = "opacity 0.5s ease";
                        bootScreen.style.opacity = "0";
                        setTimeout(() => bootScreen.style.display = 'none', 500);
                    }, 1500);
                })
                .catch(err => logToScreen(`ROM Error: ${err.message}`, true));

        } catch (err) {
            logToScreen(`Crash: ${err.message}`, true);
        }
    }

    // Wait for physical user interaction to unlock iOS constraints safely
    document.body.addEventListener("touchstart", startEngine, { once: true });
    document.body.addEventListener("click", startEngine, { once: true });

    // Standard Input Mapping
    window.addEventListener("SPECCY_INPUT", (e) => {
        if (!speccyInstance) return;
        const { key, state } = e.detail;
        const isPressed = state === 'PRESSED';
        const keyMap = { 'up': 'Q', 'down': 'A', 'left': 'O', 'right': 'P', 'fire': 'SPACE' };
        
        if (keyMap[key]) {
            speccyInstance.setKeyboard(keyMap[key], isPressed);
        }
    });
});
