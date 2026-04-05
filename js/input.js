document.addEventListener("DOMContentLoaded", () => {
    const controller = document.getElementById("floating-controller");
    const toggleBtn = document.getElementById("btn-toggle-input");
    let isTouchActive = false;
    let inputMode = "Joystick"; // Default

    // Attempt to lock orientation natively (Works on Android Chrome)
    async function lockOrientation() {
        try {
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock("landscape");
            }
        } catch (err) {
            console.log("Orientation lock not supported or denied.");
        }
    }
    
    // Call on first interaction (browsers require user gesture for locks)
    document.body.addEventListener('click', lockOrientation, { once: true });

    // --- Smart Controller Auto-Detection ---
    
    // If the user touches the screen, show the floating controls
    window.addEventListener("touchstart", () => {
        if (!isTouchActive) {
            isTouchActive = true;
            controller.classList.remove("hidden");
            console.log("Touch detected: Controls visible");
        }
    });

    // If the user presses a physical key, hide the floating controls
    window.addEventListener("keydown", (e) => {
        // Ignore the toggle button clicks firing as keydowns
        if (isTouchActive) {
            isTouchActive = false;
            controller.classList.add("hidden");
            console.log("Keyboard detected: Controls hidden");
        }
    });

    // --- Input Mode Toggle ---
    toggleBtn.addEventListener("click", () => {
        inputMode = inputMode === "Joystick" ? "Keyboard" : "Joystick";
        toggleBtn.innerText = `Mode: ${inputMode}`;
        console.log(`Input mapping switched to: ${inputMode}`);
        // In the next phase, we will broadcast this state to the emulator core
    });

    // --- Virtual Button Listeners (Mocking output for now) ---
    const buttons = document.querySelectorAll('.ctrl-btn');
    buttons.forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Stop mouse emulation
            console.log(`${btn.id} PRESSED in ${inputMode} mode`);
        });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            console.log(`${btn.id} RELEASED`);
        });
    });
});

