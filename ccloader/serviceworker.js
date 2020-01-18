self.importScripts(
	'/ccloader/js/lib/jszip.min.js',
	'/ccloader/js/packed.js',
);

// eslint-disable-next-line no-undef
const packedManger = new PackedManager();
const packedMods = [];


self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('message', (event) => {
	packedMods.splice(0);
	packedMods.push(...event.data);
});

self.addEventListener('fetch', (event) => {
	const path = new URL(event.request.url).pathname;
	if (path.startsWith('/assets/mods/') && packedMods.includes(packedManger.packedName(path))) {
		console.log('Handling fetch event for', packedManger.packedName(path), '(', packedManger._zipPath(path), '): ', packedManger._assetPath(path));
        
		event.respondWith(packedManger.get(path));
	}
});