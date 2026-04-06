document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.ctrl-btn');

    buttons.forEach(btn => {
        const key = btn.getAttribute('data-key');

        const sendInput = (state) => {
            window.dispatchEvent(new CustomEvent('SPECCY_INPUT', {
                detail: { key: key, state: state }
            }));
        };

        // Touch handlers for zero-latency mobile play
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            sendInput('PRESSED');
        }, { passive: false });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            sendInput('RELEASED');
        }, { passive: false });

        // Mouse fallbacks
        btn.addEventListener('mousedown', () => sendInput('PRESSED'));
        btn.addEventListener('mouseup', () => sendInput('RELEASED'));
        btn.addEventListener('mouseleave', () => sendInput('RELEASED'));
    });
});
