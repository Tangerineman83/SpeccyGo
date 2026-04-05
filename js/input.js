document.addEventListener("DOMContentLoaded", () => {
    const controller = document.getElementById("floating-controller");
    const toggleBtn = document.getElementById("btn-toggle-input");
    let isTouchActive = false;
    let inputMode = "Joystick"; 

    // Auto-Orientation Lock for supported devices
    document.body.addEventListener('click', async () => {
        if (screen.orientation && screen.orientation.lock) {
            try { await screen.orientation.lock("landscape"); } catch (e) {}
        }
    }, { once: true });

    // --- Smart Controller Auto-Detection ---
    window.addEventListener("touchstart", () => {
        if (!isTouchActive) {
            isTouchActive = true;
            controller.classList.remove("hidden");
        }
    });

    window.addEventListener("keydown", () => {
        if (isTouchActive) {
            isTouchActive = false;
            controller.classList.add("hidden");
        }
    });

    // --- Input Mode Toggle ---
    toggleBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        inputMode = inputMode === "Joystick" ? "Keyboard" : "Joystick";
        toggleBtn.innerText = `Mode: ${inputMode}`;
    });
    
    toggleBtn.addEventListener("click", () => {
        inputMode = inputMode === "Joystick" ? "Keyboard" : "Joystick";
        toggleBtn.innerText = `Mode: ${inputMode}`;
    });

    // --- Virtual Button Broadcaster ---
    const buttons = document.querySelectorAll('.ctrl-btn');
    
    const dispatchInput = (keyId, state) => {
        window.dispatchEvent(new CustomEvent("SPECCY_INPUT", {
            detail: { key: keyId, state: state, mode: inputMode }
        }));
    };

    buttons.forEach(btn => {
        const keyId = btn.getAttribute('data-key');
        
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            dispatchInput(keyId, 'PRESSED');
        });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            dispatchInput(keyId, 'RELEASED');
        });
    });
});
