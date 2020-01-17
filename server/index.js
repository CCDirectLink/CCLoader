const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const JSZip = require('../ccloader/js/lib/jszip.js');
const ZipHandler = require('./ziphandler.js');

const zipHandler = new ZipHandler(new JSZip);




const app = express();
app.use('/', express.static(process.cwd()))
app.get('/mods/api/*', requestHandler);

async function requestHandler(req, res) {
    const fullUrl = `http://${req.headers.host + req.url}`;

    const url = new URL(fullUrl);

    try {
        if (url.pathname === '/mods/api/preload') {
            await preload(url.searchParams.get('path'), req)
            res.writeHead(200, 'OK');
            res.end(null);
        } else if (url.pathname === '/mods/api/get-assets') {
            const assets = await getAssets(url.searchParams.get('path'));
            res.writeHead(200, 'OK', {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify(assets));
        } else if (url.pathname === '/mods/api/get-asset') {
            const basePath = url.searchParams.get('path');
            const relativePath = url.searchParams.get('relativePath');
            const assetArrayBuffer = await getAsset(basePath, relativePath);
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


async function preload(zipPath, req) {
    const folderPath = zipPath + '/';
    
    if (!zipHandler.hasPath(folderPath)) {
        const fullPath = req.protocol + '://' + req.get('host') + '/' + zipPath;
        const blob = await fetch(fullPath).then((res) => res.arrayBuffer());
        await zipHandler.loadZip(zipPath, blob);
    }
}

async function getAssets(zipPath) {
    const folderPath = zipPath + '/';
    if (!zipHandler.hasPath(folderPath)) {
        throw {
            status: 404,
            statusText: 'File Not Found'
        };
    }
    
    const pathToAssets = folderPath + 'assets/';
    if (!zipHandler.hasPath(pathToAssets)) {
        return [];
    }
    return zipHandler.listFiles(pathToAssets);
}

async function getAsset(zipPath, relativePath) {
    const folderPath = zipPath + '/';
    if (!zipHandler.hasPath(folderPath)) {
        throw {
            status: 404,
            statusText: 'Zip File Not Found'
        };
    }

    
    const pathToAsset = folderPath + relativePath;
    // 
    if (!zipHandler.hasPath(pathToAsset)) {
        throw {
            status: 404,
            statusText: 'File Not Found'
        };
    }

    return zipHandler.getAsset(pathToAsset, 'arraybuffer');
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


app.listen(3000);