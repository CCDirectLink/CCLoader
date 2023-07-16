self.importScripts(
	'/ccloader/js/lib/jszip.min.js',
	'/ccloader/js/packed.js',
);

// eslint-disable-next-line no-undef
const packedManager = new PackedManager();
// eslint-disable-next-line no-undef
const packedApi = new PackedApi(packedManager);

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', () => {
	self.clients.claim();
});

self.addEventListener('fetch', (fetchEvent) => {
	packedApi.handleRequest(fetchEvent);
});
