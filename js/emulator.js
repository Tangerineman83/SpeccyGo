document.addEventListener("DOMContentLoaded", () => {
    const viewportId = 'speccy-container'; 
    const libraryMenu = document.getElementById("library-menu");
    let speccyInstance = null;
    let currentTarget = "";

    // Optimized Keyboard Layout
    const leftKeys = ["1","2","3","4","5","Q","W","E","R","T","A","S","D","F","G","SHF","Z","X","C","V"];
    const rightKeys = ["6","7","8","9","0","Y","U","I","O","P","H","J","K","L","ENT","SYM","B","N","M","SPC"];

    const setupKB = (id, keys) => {
        const container = document.getElementById(id);
        keys.forEach(k => {
            const btn = document.createElement('div');
            btn.className = 'kb-key';
            btn.innerText = k;
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); sendKey(k, true); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); sendKey(k, false); });
            container.appendChild(btn);
        });
    };
    setupKB('v-kb-left', leftKeys);
    setupKB('v-kb-right', rightKeys);

    document.getElementById('btn-kb-toggle').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('v-kb-left').classList.toggle('hidden');
        document.getElementById('v-kb-right').classList.toggle('hidden');
    });

    function sendKey(label, isPressed) {
        const charMap = {
            "ENT": { k: "Enter", c: 13 },
            "SPC": { k: " ", c: 32 },
            "SHF": { k: "Shift", c: 16 },
            "SYM": { k: "Control", c: 17 }
        };
        
        let keyData = charMap[label] || { k: label, c: label.charCodeAt(0) };
        
        // Force the KeyboardEvent with proper Safari KeyCode injection
        const ev = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', {
            key: keyData.k,
            code: isFinite(label) ? `Digit${label}` : `Key${label.toUpperCase()}`,
            bubbles: true,
            cancelable: true
        });

        Object.defineProperty(ev, 'keyCode', { get: () => keyData.c });
        Object.defineProperty(ev, 'which', { get: () => keyData.c });

        // Dispatch to the whole document to ensure JSSpeccy catches it
        document.dispatchEvent(ev);
    }

    const fileInput = document.getElementById('rom-upload');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            currentTarget = URL.createObjectURL(file);
            libraryMenu.classList.add('hidden');
            startEngine();
        }
    });

    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');
        const map = {
            'left': { k: 'Z', c: 90 }, 'right': { k: 'X', c: 88 },
            'up': { k: 'K', c: 75 }, 'down': { k: 'M', c: 77 },
            'fire': { k: ' ', c: 32 }, 'enter': { k: 'Enter', c: 13 }
        };
        const target = map[key];
        if (target) {
            const ev = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', { key: target.k, bubbles: true });
            Object.defineProperty(ev, 'keyCode', { get: () => target.c });
            document.dispatchEvent(ev);
        }
    });

    function startEngine() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
        speccyInstance = JSSpeccy(viewportId, { 'autostart': true, 'model': '48k' });
        setTimeout(() => {
            speccyInstance.loadFromUrl(currentTarget, {'autoload': true});
            document.getElementById('floating-controller').classList.remove('hidden');
            document.getElementById('boot-screen').style.display = 'none';
        }, 1000);
    }

    document.querySelectorAll('.rom-btn[data-rom]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTarget = `assets/roms/${btn.getAttribute('data-rom')}`;
            libraryMenu.classList.add('hidden');
            startEngine();
        });
    });
});
