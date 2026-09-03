const CACHE_NAME = 'uzuncarsi-scenes-v16';
const SCENE_PATHS = [
    '/models/world/always.glb',
    '/models/world/outside.glb',
    '/models/guzel-optik/store-environment.glb',
    '/models/sude-home/store-raw.glb',
    '/models/nisantasi/store-raw.glb',
    '/models/telefon/store-raw.glb'
];

const isSceneRequest = (request) => {
    if (request.method !== 'GET') return false;
    const pathname = new URL(request.url).pathname.replace(self.registration.scope.replace(self.location.origin, '').replace(/\/$/, ''), '');
    return SCENE_PATHS.some((path) => pathname.endsWith(path))
        || (/\/models\//.test(pathname) && /\.(?:glb|gltf|json)$/i.test(pathname))
        || (/\/environments\//.test(pathname) && /\.hdr$/i.test(pathname));
};

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter((key) => key.startsWith('uzuncarsi-scenes-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (!isSceneRequest(event.request)) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
        return response;
    })());
});
