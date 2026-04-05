window.addEventListener("error", function(e) {
    logToScreen(`SYSTEM HALT: ${e.message}`, true);
});

// Trap asynchronous WebWorker crashes
window.addEventListener("unhandledrejection", function(e) {
    logToScreen(`ASYNC HALT: ${e.reason}`, true);
});

// Intercept network requests to catch silent 404s for the WASM file
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    logToScreen(`NET: Requesting ${url.split('/').pop()}...`);
    try {
        const response = await originalFetch.apply(this, args);
        if (!response.ok) logToScreen(`NET FAIL: HTTP ${response.status} on ${url}`, true);
        return response;
    } catch (e) {
        logToScreen(`NET CRASH: ${e.message}`, true);
        throw e;
    }
};

let bootLog = null;
function logToScreen(message, isError = false) {
    console.log(message);
    if (bootLog) {
        bootLog.innerHTML += `<br><span style="color:${isError ? '#ff3333' : '#0f0'}">> ${message}</span>`;
    }
}

function bootSpeccyGo() {
    let speccyContainer = document.getElementById("speccy-container");
    let bootScreen = document.getElementById("boot-screen");
    bootLog = document.getElementById("boot-log");

    // Make the boot screen semi-transparent so we can see the canvas underneath
    if (bootScreen) {
        bootScreen.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
        bootScreen.style.pointerEvents = "none"; 
    }

    if (speccyContainer && !speccyContainer.requestFullscreen) {
        speccyContainer.requestFullscreen = speccyContainer.webkitRequestFullscreen || function(){};
    }

    let speccyInstance = null;

    try {
        logToScreen("Initializing Naked Z80 Engine...");

        // Re-enabling the UI visually proves if the canvas renderer is working at all
        speccyInstance = JSSpeccy(speccyContainer, {
            machine: 48, 
            border: true,
            uiEnabled: true, 
            autoStart: false 
        });

        logToScreen("Engine instantiated. Waiting for WASM to compile...");
        
    } catch (err) {
        logToScreen(`SYNC CRASH: ${err.message}`, true);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSpeccyGo);
} else {
    bootSpeccyGo();
}
