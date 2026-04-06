document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.ctrl-btn');

    buttons.forEach(btn => {
        const key = btn.getAttribute('data-key');

        const sendInput = (state) => {
            window.dispatchEvent(new CustomEvent('SPECCY_INPUT', {
                detail: { key: key, state: state }
            }));
        };

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // STOPS SCROLLING
            sendInput('PRESSED');
        }, { passive: false });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            sendInput('RELEASED');
        }, { passive: false });
    });
});
