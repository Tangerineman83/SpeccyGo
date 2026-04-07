document.addEventListener("DOMContentLoaded", () => {
    const viewportId = 'speccy-container'; 
    const libraryMenu = document.getElementById("library-menu");
    let speccyInstance = null;
    let currentTarget = "";

    // Generate Keyboard
    const leftKeys = ["1","2","3","4","5","Q","W","E","R","T","A","S","D","F","G","CAPS","Z","X","C","V"];
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

    document.getElementById('btn-kb-toggle').addEventListener('click', () => {
        document.getElementById('v-kb-left').classList.toggle('hidden');
        document.getElementById('v-kb-right').classList.toggle('hidden');
    });

    function sendKey(label, isPressed) {
        let keyChar = label;
        if(label === "ENT") keyChar = "Enter";
        if(label === "SPC") keyChar = " ";
        if(label === "CAPS") keyChar = "Shift";
        const ev = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', { key: keyChar, bubbles: true });
        document.getElementById(viewportId).dispatchEvent(ev);
    }

    // --- RELIABLE FILE LOADER ---
    const fileInput = document.getElementById('rom-upload');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            currentTarget = URL.createObjectURL(file);
            libraryMenu.classList.add('hidden');
            startEngine();
        }
    });

    // --- CONTROLS ---
    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');
        const map = {
            'left': 'Z', 'right': 'X', 'up': 'K', 'down': 'M', 'fire': ' ', 'enter': 'Enter'
        };
        const k = map[key];
        if (k) {
            const ev = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', { key: k, bubbles: true });
            document.getElementById(viewportId).dispatchEvent(ev);
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
