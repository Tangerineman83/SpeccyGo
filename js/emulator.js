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

    // ... existing logToScreen functions ...

function startEngine() {
    document.body.removeEventListener("touchstart", startEngine);
    document.body.removeEventListener("click", startEngine);

    logToScreen("Igniting Z80 Engine...");

    try {
        // Points to 'speccy-container' which now exists in index.html
        speccyInstance = JSSpeccy('speccy-container', {
            'autostart': true,
            'model': '48k'
        });

        logToScreen(`Mounting ${targetRom}...`);
        
        // Brief pause to allow the machine to complete its internal 1982 ROM check
        setTimeout(() => {
            speccyInstance.loadFromUrl(targetRom, {'autoload': true});
            
            setTimeout(() => {
                bootScreen.style.transition = "opacity 0.8s ease";
                bootScreen.style.opacity = "0";
                setTimeout(() => bootScreen.style.display = 'none', 800);
            }, 1000);
        }, 1200);

    } catch (err) {
        logToScreen(`Crash: ${err.message}`, true);
    }
}


    document.body.addEventListener("touchstart", startEngine, { once: true });
    document.body.addEventListener("click", startEngine, { once: true });
});
