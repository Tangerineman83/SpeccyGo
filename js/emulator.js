window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
});

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("speccy-canvas");
    const bootScreen = document.getElementById("boot-screen");
    const bootLog = document.getElementById("boot-log");

    function logToScreen(message, isError = false) {
        if (bootLog) {
            bootLog.innerHTML += `<br><span style="color:${isError ? '#ff3333' : '#0f0'}">> ${message}</span>`;
        }
    }

    logToScreen("BIOS Loaded. Pure JS Engine standing by.");
    logToScreen("TAP SCREEN TO BOOT.");

    let speccyInstance = null;
    const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

    function startEngine() {
        document.body.removeEventListener("touchstart", startEngine);
        document.body.removeEventListener("click", startEngine);

        logToScreen("Compiling Engine...");

        try {
            // Initialize the v2.2.1 engine
            speccyInstance = new JSSpeccy(canvas, {
                machine: '48k',
                zoom: 1,
                border: true,
                autoload: true
            });

            logToScreen(`Fetching ${targetRom}...`);
            
            // Use the v2.2.1 loadFromUrl method
            speccyInstance.loadFromUrl(targetRom, { autoload: true });
            
            logToScreen("Booting Spectrum...");
            
            setTimeout(() => {
                bootScreen.style.transition = "opacity 0.5s ease";
                bootScreen.style.opacity = "0";
                setTimeout(() => bootScreen.style.display = 'none', 500);
            }, 2000);

        } catch (err) {
            logToScreen(`Crash: ${err.message}`, true);
        }
    }

    document.body.addEventListener("touchstart", startEngine, { once: true });
    document.body.addEventListener("click", startEngine, { once: true });
});
