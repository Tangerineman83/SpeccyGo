document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.ctrl-btn');

    buttons.forEach(btn => {
        const key = btn.getAttribute('data-key');

        const handleInput = (state) => {
            window.dispatchEvent(new CustomEvent('SPECCY_INPUT', {
                detail: { key: key, state: state }
            }));
        };

        // iOS specific touch events
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleInput('PRESSED');
        });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleInput('RELEASED');
        });

        // Fallback for mouse/desktop
        btn.addEventListener('mousedown', () => handleInput('PRESSED'));
        btn.addEventListener('mouseup', () => handleInput('RELEASED'));
    });
});
