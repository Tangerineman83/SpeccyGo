document.addEventListener("DOMContentLoaded", () => {
    const viewportId = 'speccy-container'; 
    const libraryMenu = document.getElementById("library-menu");
    let speccyInstance = null;

    // --- KEYBOARD CONFIG ---
    const leftKeys = ["1","2","3","4","5","Q","W","E","R","T","A","S","D","F","G","CAPS","Z","X","C","V"];
    const rightKeys = ["6","7","8","9","0","Y","U","I","O","P","H","J","K","L","ENT","SYM","B","N","M","SPC"];

    function setupKB(containerId, keys) {
        const container = document.getElementById(containerId);
        keys.forEach(k => {
            const btn = document.createElement('div');
            btn.className = 'kb-key';
            btn.innerText = k;
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); sendKey(k, 'PRESSED'); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); sendKey(k, 'RELEASED'); });
            container.appendChild(btn);
        });
    }
    setupKB('v-kb-left', leftKeys);
    setupKB('v-kb-right', rightKeys);

    document.getElementById('btn-kb-toggle').addEventListener('click', () => {
        document.getElementById('v-kb-left').classList.toggle('hidden');
        document.getElementById('v-kb-right').classList.toggle('hidden');
    });

    function sendKey(label, state) {
        const isPressed = (state === 'PRESSED');
        let keyChar = label;
        if(label === "ENT") keyChar = "ENTER";
        if(label === "SPC") keyChar = " ";
        if(label === "CAPS") keyChar = "SHIFT";
        
        // Map to keycodes if needed, but JSSpeccy handles strings often
        const kbEvent = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', { key: keyChar, bubbles: true });
        document.getElementById(viewportId).dispatchEvent(kbEvent);
    }

    // --- LOAD FROM DEVICE FIX ---
    const customRomBtn = document.getElementById('btn-custom-rom');
    const fileInput = document.getElementById('rom-upload');
    
    const triggerFile = (e) => {
        e.preventDefault();
        fileInput.click();
    };
    customRomBtn.addEventListener('click', triggerFile);
    customRomBtn.addEventListener('touchstart', triggerFile);

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            targetRom = URL.createObjectURL(file);
            libraryMenu.classList.add('hidden');
            startEngine();
        }
    });

    // --- INPUT MAPPING ---
    window.addEventListener("SPECCY_INPUT", (e) => {
        const { key, state } = e.detail;
        const isPressed = (state === 'PRESSED');
        const keyMap = {
            'left': { k: 'Z', c: 90 }, 'right': { k: 'X', c: 88 },
            'up': { k: 'K', c: 75 }, 'down': { k: 'M', c: 77 },
            'fire': { k: ' ', c: 32 }, 'enter': { k: 'Enter', c: 13 }
        };
        const target = keyMap[key];
        if (target) {
            const ev = new KeyboardEvent(isPressed ? 'keydown' : 'keyup', { key: target.k, keyCode: target.c, which: target.c, bubbles: true });
            Object.defineProperty(ev, 'keyCode', { get: () => target.c });
            document.getElementById(viewportId).dispatchEvent(ev);
        }
    });

    function startEngine() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            ctx.resume();
            speccyInstance = JSSpeccy(viewportId, { 'autostart': true, 'model': '48k' });
            setTimeout(() => {
                speccyInstance.loadFromUrl(targetRom, {'autoload': true});
                document.getElementById('floating-controller').classList.remove('hidden');
                document.getElementById('boot-screen').style.display = 'none';
            }, 1000);
        } catch (err) { console.error(err); }
    }

    const romButtons = document.querySelectorAll('.rom-btn[data-rom]');
    romButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            targetRom = `assets/roms/${btn.getAttribute('data-rom')}`;
            libraryMenu.classList.add('hidden');
            startEngine();
        });
    });
});
