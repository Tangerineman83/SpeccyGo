window.addEventListener("error", function(e) {
    const log = document.getElementById("boot-log");
    if (log) log.innerHTML += `<br><span style="color:#ff3333;">> SYSTEM HALT: ${e.message}</span>`;
});

function bootSpeccyGo() {
    let speccyContainer = document.getElementById("speccy-container");
    let bootScreen = document.getElementById("boot-screen");
    let bootLog = document.getElementById("boot-log");

    if (speccyContainer && !speccyContainer.requestFullscreen) {
        speccyContainer.requestFullscreen = speccyContainer.webkitRequestFullscreen || function(){};
    }

    function logToScreen(message, isError = false) {
        if (bootLog) {
            bootLog.innerHTML += `<br><span style="color:${isError ? '#ff3333' : '#0f0'}">> ${message}</span>`;
        }
    }

    let speccyInstance = null;

    try {
        logToScreen("Initializing Naked Z80 Engine (No ROM)...");

        // 1. Boot the engine completely empty
        speccyInstance = JSSpeccy(speccyContainer, {
            machine: 48, 
            border: true,
            uiEnabled: false,
            autoStart: true 
        });

        logToScreen("Waiting for user tap to unlock iOS audio...");
        
        // Hide our green boot terminal so you can click the grey JSSpeccy Play button
        setTimeout(() => {
            if (bootScreen) {
                bootScreen.style.display = 'none';
            }
        }, 1500);

        // 2. Listen for the tap, but DO NOT load a game.
        speccyContainer.addEventListener("click", () => {
            console.log("[SpeccyGo] Engine unlocked by user tap.");
            // If the engine is healthy, the screen will turn white with the Sinclair logo.
        });

    } catch (err) {
        logToScreen(`Crash: ${err.message}`, true);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSpeccyGo);
} else {
    bootSpeccyGo();
}
