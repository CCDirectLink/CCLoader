const http = require('http');

export class PackedModServer {
    constructor() {
        this.server = null;
        this.zip = null;
    }

    async initialize() {   
        if (!window.isBrowser) {
            if (this.zip === null) {
                this.zip = new JSZip();
            }

            if (this.server === null) {
                const server = this.server = http.createServer();
                server.on('request', async (req, res) => await this.onRequest(req,res));
    
                window.addEventListener('onbeforeunload', function(){
                    console.log('Closing server');
                    server.close();
                });
    
                server.listen(3000);
            }

        }
    }

    _createFolders(root, folderArr) {
        for (const folder of folderArr) {
            root = root.folder(folder);
        }
        return root;
    }

    async onRequest(req, res)  {
        console.log('I sent this', req);
        const fullUrl = `http://${req.headers.host + req.url}`;

        const url = new URL(fullUrl);

        try {
            if (url.pathname === '/mods/api/preload') {
                await this.preload(url.searchParams.get('path'))
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
                const asset = new Buffer(assetArrayBuffer, "binary");
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
    async preload(zipPath) {
        const folderPath = zipPath + '/';
        console.log('Folder', this.zip.files[folderPath]);
        if (!this.zip.files[folderPath]) {
            const root = this._createFolders(this.zip, zipPath.split('/'));
            const blob = await fetch('../'+ zipPath).then((res) => res.blob());
            await root.loadAsync(blob, {createFolders: true});
        }
    }

    async getAssets(zipPath) {
        const folderPath = zipPath + '/';
        if (!this.zip.files[folderPath]) {
            throw {
                status: 404,
                statusText: 'File Not Found'
            };
        }


        const filePaths = [];
        const pathToAssets = folderPath + 'assets/';
        if (!this.zip.files[pathToAssets]) {
            return filePaths;
        }
        const folderEntry = this._createFolders(this.zip, [...zipPath.split('/'), 'assets']);
        folderEntry.forEach((relativePath, file) => {
            if (!file.dir) {
                filePaths.push(pathToAssets + relativePath);
            }
        });


        return filePaths;

    }


    async getAsset(zipPath, relativePath) {
        const folderPath = zipPath + '/';
        if (!this.zip.files[folderPath]) {
            throw {
                status: 404,
                statusText: 'Zip File Not Found'
            };
        }

        const resource = this.zip.files[folderPath + relativePath];

        if (!resource) {
            throw {
                status: 404,
                statusText: 'File Not Found'
            };
        }

        return resource.async('arraybuffer');
    }

    /*async getBlob(zipEntry) {
        return new Promise((resolve, reject) => {
            const extension = zipEntry.name.split('.').pop();
            zipEntry.getBlob(getFileMime(extension), (data) => {
                resolve(data)
            }, function() {
                console.log('progress', arguments)
            }, (err) => {
                console.log('An error has occured while attempting to get blob', err);
                reject(err)
            });
        });
    }*/

    /*getAllDirectories(rootPath, zipEntry, allEntries = []) {
        if (zipEntry.directory) {
            const newRootPath = rootPath + zipEntry.name + '/';
            zipEntry.children.forEach((childEntry) => {
                this.getAllDirectories(newRootPath, childEntry, allEntries);
            });
        } else {
            allEntries.push(rootPath + zipEntry.name);
        }
        return allEntries;
    }*/

}

function getFileMime(extension) {
    if (extension === 'png') {
        return 'image/png';
    } else if (extension === 'jpg' || extension === 'jpeg') {
        return 'image/jpeg';
    } else if (extension === 'ogg') {
        return 'audio/ogg';
    } else if (extension === 'json') {
        return 'application/json';
    } else if (extension === 'js') {
        return 'application/javascript';
    }
}