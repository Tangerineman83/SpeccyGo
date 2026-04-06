window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
});

document.addEventListener("DOMContentLoaded", () => {
    // We use the ID of the container, just like the demo you found
    const viewportId = 'speccy-container'; 
    const bootScreen = document.getElementById("boot-screen");
    const bootLog = document.getElementById("boot-log");

    function logToScreen(message, isError = false) {
        if (bootLog) {
            bootLog.innerHTML += `<br><span style="color:${isError ? '#ff3333' : '#0f0'}">> ${message}</span>`;
        }
    }

    logToScreen("BIOS v2.2.1 Loaded. standing by.");
    logToScreen("TAP SCREEN TO BOOT.");

    let speccyInstance = null;
    const targetRom = `assets/roms/${new URLSearchParams(window.location.search).get('game') || "FastFood.tzx"}`;

    function startEngine() {
        document.body.removeEventListener("touchstart", startEngine);
        document.body.removeEventListener("click", startEngine);

        logToScreen("Igniting Z80 Engine...");

        try {
            // This is the v2.2.1 constructor from the HTML you found
            speccyInstance = JSSpeccy(viewportId, {
                'autostart': true,
                'model': '48k'
            });

            logToScreen(`Mounting ${targetRom}...`);
            
            // Wait 1 second for the Spectrum to "wake up" before loading the tape
            setTimeout(() => {
                speccyInstance.loadFromUrl(targetRom, {'autoload': true});
                
                // Fade out the boot screen
                setTimeout(() => {
                    bootScreen.style.transition = "opacity 0.5s ease";
                    bootScreen.style.opacity = "0";
                    setTimeout(() => bootScreen.style.display = 'none', 500);
                }, 1000);
            }, 1000);

        } catch (err) {
            logToScreen(`Crash: ${err.message}`, true);
        }
    }

    document.body.addEventListener("touchstart", startEngine, { once: true });
    document.body.addEventListener("click", startEngine, { once: true });
});
