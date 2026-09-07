export const assetUrl = (value, revision = import.meta.env?.VITE_ASSET_REVISION) => {
    if (!value || !revision) return value;
    const [pathname, fragment] = String(value).split('#');
    const [filename, query] = pathname.split('?');
    const params = new URLSearchParams(query);
    params.set('rev', revision);
    return `${filename}?${params}${fragment === undefined ? '' : `#${fragment}`}`;
};
