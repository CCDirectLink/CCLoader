function splitPackedUrl(url) {
    const tempUrl = new URL(url);
    // stop at .ccmod
    const len = tempUrl.pathname.lastIndexOf(".ccmod") + ".ccmod".length;
    return {
        basePath: tempUrl.pathname.substring(1, len),
        relativePath: tempUrl.pathname.substring(len + 1)
    };
}

self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting.bind(self));
});

self.addEventListener('active', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);

    if (event.request.method === "GET") {
        if (url.pathname.includes('mods/api/preload')) {
            const basePath = url.searchParams.get('path');
            event.respondWith(fetch(`http://localhost:3000/mods/api/preload?path=${basePath}`));           
        } else if (url.pathname.includes("mods/api/get-assets")) {
            const basePath = url.searchParams.get('path');
            const type = url.searchParams.get('type') || '';
            event.respondWith(fetch(`http://localhost:3000/mods/api/get-assets?path=${basePath}&type=${type}`));
        } else if (url.pathname.match(/mods\/[^\/]+.ccmod/)) {
            const {basePath, relativePath} = splitPackedUrl(event.request.url);
            event.respondWith(fetch(`http://localhost:3000/mods/api/get-asset?path=${basePath}&relativePath=${relativePath}`));
    
        }
    }
});
