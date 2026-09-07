const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

const visibleFocusable = (root) => [...root.querySelectorAll(FOCUSABLE)]
    .filter((node) => !node.hidden && node.getClientRects().length > 0);

/**
 * Keeps keyboard focus inside an open dialog and restores it when the dialog
 * closes. The dialog owns Escape separately so each feature can decide what
 * closing means.
 */
export const createFocusTrap = (root, { initialFocus = null } = {}) => {
    let previousFocus = null;
    let active = false;

    const handleKeyDown = (event) => {
        if (!active || event.key !== 'Tab') return;
        const focusable = visibleFocusable(root);
        if (!focusable.length) {
            event.preventDefault();
            root.focus({ preventScroll: true });
            return;
        }
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus({ preventScroll: true });
        }
    };

    return {
        activate() {
            if (active) return;
            active = true;
            previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            root.setAttribute('tabindex', '-1');
            document.addEventListener('keydown', handleKeyDown, true);
            const target = typeof initialFocus === 'function' ? initialFocus() : initialFocus;
            (target || visibleFocusable(root)[0] || root).focus({ preventScroll: true });
        },
        deactivate({ restoreFocus = true } = {}) {
            if (!active) return;
            active = false;
            document.removeEventListener('keydown', handleKeyDown, true);
            if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
            previousFocus = null;
        },
        dispose() {
            this.deactivate({ restoreFocus: false });
        }
    };
};
