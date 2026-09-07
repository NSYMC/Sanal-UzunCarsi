/** 24 × 24 ızgarada, currentColor kullanan SVG ikonları. */

const PATHS = {
    // Gezinme
    cart: '<circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M2.5 3.5h2.6l2.3 11.1h10.2l2-8H6.6"/>',
    heart: '<path d="M12 20.2 4.6 13a4.4 4.4 0 0 1 6.2-6.2l1.2 1.2 1.2-1.2A4.4 4.4 0 1 1 19.4 13Z"/>',
    pin: '<path d="M12 21.5s6.6-6 6.6-11a6.6 6.6 0 1 0-13.2 0c0 5 6.6 11 6.6 11Z"/><circle cx="12" cy="10.4" r="2.4"/>',
    map: '<path d="M2.8 6.4 9 4.2v13.4l-6.2 2.2Z"/><path d="M9 4.2 15 6.6v13.2L9 17.6Z"/><path d="M15 6.6 21.2 4.4v13.4L15 19.8Z"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
    close: '<path d="m6 6 12 12"/><path d="M18 6 6 18"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.4 15.4 4.2 4.2"/>',
    check: '<path d="m4.8 12.6 4.8 4.8 9.6-10.2"/>',
    // Sahne araçları
    explode: '<path d="M12 2.6 20 7l-8 4.4L4 7Z"/><path d="m4 12 8 4.4L20 12"/><path d="m4 17 8 4.4L20 17"/>',
    speaker: '<path d="M4.5 9.5h3.2L12 5.8v12.4L7.7 14.5H4.5Z"/><path d="M15.4 9.6a3.6 3.6 0 0 1 0 4.8"/><path d="M17.8 7.2a7 7 0 0 1 0 9.6"/>',
    speakerOff: '<path d="M4.5 9.5h3.2L12 5.8v12.4L7.7 14.5H4.5Z"/><path d="m16 9.8 4.4 4.4"/><path d="m20.4 9.8-4.4 4.4"/>',
    trash: '<path d="M4.6 6.4h14.8"/><path d="M9.4 6.4V4.2h5.2v2.2"/><path d="M6.8 6.4 7.7 20h8.6l.9-13.6"/>',
    // Mağaza türleri
    glasses: '<circle cx="6.6" cy="13.4" r="3.6"/><circle cx="17.4" cy="13.4" r="3.6"/><path d="M10.2 13.4a2.4 2.4 0 0 1 3.6 0"/><path d="M3 11 5.2 6.6h2.6"/><path d="M21 11 18.8 6.6h-2.6"/>',
    bowl: '<path d="M3.2 10.8h17.6a8.8 8.8 0 0 1-17.6 0Z"/><path d="M8.6 7.4c0-1.6 1.5-1.9 1.5-3.2"/><path d="M13.4 7.4c0-1.6 1.5-1.9 1.5-3.2"/>',
    ring: '<circle cx="12" cy="14.6" r="5.8"/><path d="m9.4 8.4 2.6-4.6 2.6 4.6"/><path d="M9.4 8.4h5.2"/>',
    phone: '<rect x="6.6" y="2.8" width="10.8" height="18.4" rx="2"/><path d="M10.6 18.4h2.8"/>'
};

/** Ürün kimliğinden değil, mağaza türünden ikon seçilir. */
export const STORE_ICONS = Object.freeze({
    'guzel-optik': 'glasses',
    'sude-home': 'bowl',
    nisantasi: 'ring',
    telefon: 'phone'
});

/**
 * İkonun SVG işaretlemesini döndürür. `filled` yalnız kalp için anlamlıdır.
 */
export const iconMarkup = (name, { size = 18, filled = false, strokeWidth = 1.6 } = {}) => {
    const path = PATHS[name];
    if (!path) return '';
    return `<svg class="ui-icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"`
        + ` fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${strokeWidth}"`
        + ` stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
};

/** DOM'a doğrudan eklenebilen ikon düğümü. */
export const iconElement = (name, options = {}) => {
    const wrapper = document.createElement('span');
    wrapper.className = 'ui-icon-slot';
    wrapper.innerHTML = iconMarkup(name, options);
    return wrapper.firstElementChild || wrapper;
};

export const hasIcon = (name) => Object.prototype.hasOwnProperty.call(PATHS, name);
