self.addEventListener('activate', (event) => {
});

self.addEventListener('fetch', function(event) {
   
    if (event.request.url.includes('mods/')) {
        console.log(event.request)
    }

});