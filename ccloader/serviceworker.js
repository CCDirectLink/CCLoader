self.importScripts(
	'/ccloader/js/lib/jszip.min.js',
	'/ccloader/js/packed.js',
);

// eslint-disable-next-line no-undef
const packedManger = new PackedManager();


self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', () => {
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	/** @type {Request} */
	const request = event.request;
	const path = new URL(request.url).pathname;

	if (request.headers.has('X-Cmd')) {
		try {
			switch (request.headers.get('X-Cmd')) {
			case 'getFiles':
				event.respondWith((async () => new Response(JSON.stringify(
					await packedManger.getFiles(path)),
				{status: 200}))());
				break;
			case 'isDirectory':
				event.respondWith((async () => new Response(JSON.stringify(
					await packedManger.isDirectory(path)),
				{status: 200}))());
				break;
			}
		} catch (e) {
			console.error('An error occured while inspecting a packed mod', e);
		}
	}

	if (path.startsWith('/assets/mods/')) {
		const packedName = packedManger.packedName(path);
		//console.log('Handling fetch event for', packedManger.packedName(path), '(', packedManger._zipPath(path), '): ', packedManger._assetPath(path));

		event.respondWith((async () => {
			const cache = await caches.open('packedMods');
			if (await cache.match('http://localhost/assets/mods/' + packedName)) {
				return packedManger.get(path);
			}
			return fetch(request);
		})());
	}
});
