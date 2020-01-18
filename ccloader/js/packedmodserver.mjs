import {ZipHandler} from "./ziphandler.mjs";

export class PackedModServer {
    constructor(jsZip) {
        this.server = null;
        this.zipHandler = new ZipHandler(jsZip);
    }

    setFetch(newFetch) {
        this.fetch = newFetch;
    }

    async initialize() {   
        if (typeof window !== "undefined" && !window.isBrowser) {
            if (this.server === null) {
                const server = this.server = require('http').createServer();
                server.on('request', async (req, res) => await this.onRequest(req,res));
    
                window.addEventListener('onbeforeunload', function(){
                    console.log('Closing server');
                    server.close();
                });
    
                server.listen(3000);
            }
        }


    }

    async onRequest(req, res)  {
        const fullUrl = `http://${req.headers.host + req.url}`;

        const url = new URL(fullUrl);

        try {
            if (url.pathname === '/mods/api/preload') {
                await this.preload(url.searchParams.get('path'), req)
                res.writeHead(200, 'OK');
                res.end(null);
            } else if (url.pathname === '/mods/api/get-assets') {
                const assets = await this.getAssets(url.searchParams.get('path'));
                res.writeHead(200, 'OK', {
                    'Content-Type': 'application/json'
                });
                res.end(JSON.stringify(assets));
            } else if (url.pathname === '/mods/api/get-asset') {
                const basePath = url.searchParams.get('path');
                const relativePath = url.searchParams.get('relativePath');
                const assetArrayBuffer = await this.getAsset(basePath, relativePath);
                const asset = Buffer.from(assetArrayBuffer, "binary");
                res.writeHead(200, 'OK', {
                    'Content-Type': getFileMime(relativePath)
                });
                res.end(asset);
            }

        } catch (e) {
            if (e.status) {
                res.writeHead(e.status, e.statusText);
            } else {
                console.log(e);
                res.writeHead(504, 'Internal Error');
            }
            res.end('');
        }
    }


    /** Event Handlers */

    async preload(zipPath, req) {
        const folderPath = zipPath + '/';
        
        if (!this.zipHandler.hasPath(folderPath)) {
            let fetch;
            let fullPath;
            if (this.fetch) {
                fetch = this.fetch;
                fullPath = 'http://' + req.get('host') + '/' + zipPath;
            } else if (typeof window !== "undefined") {
                fetch = window.fetch;
                fullPath = `../${zipPath}`;
            }           

            const blob = await fetch(fullPath).then((res) => res.arrayBuffer());
            await this.zipHandler.loadZip(zipPath, blob);
        }
    }


    async getAssets(zipPath) {
        const folderPath = zipPath + '/';
        if (!this.zipHandler.hasPath(folderPath)) {
            throw {
                status: 404,
                statusText: 'File Not Found'
            };
        }
        
        const pathToAssets = folderPath + 'assets/';
        if (!this.zipHandler.hasPath(pathToAssets)) {
            return [];
        }
        return this.zipHandler.listFiles(pathToAssets);
    }


    async getAsset(zipPath, relativePath) {
        const folderPath = zipPath + '/';
        if (!this.zipHandler.hasPath(folderPath)) {
            throw {
                status: 404,
                statusText: 'Zip File Not Found'
            };
        }

        
        const pathToAsset = folderPath + relativePath;
        // 
        if (!this.zipHandler.hasPath(pathToAsset)) {
            throw {
                status: 404,
                statusText: 'File Not Found'
            };
        }

        return this.zipHandler.getAsset(pathToAsset, 'arraybuffer');
    }
}


function getFileMime(fileName) {
    if (fileName.endsWith('png')) {
        return 'image/png';
    } else if (fileName.endsWith('jpg') || fileName.endsWith('jpeg')) {
        return 'image/jpeg';
    } else if (fileName.endsWith('ogg')) {
        return 'audio/ogg';
    } else if (fileName.endsWith('json')) {
        return 'application/json';
    } else if (fileName.endsWith('js')) {
        return 'application/javascript';
    }
}
