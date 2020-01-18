import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require('fs');
const path = require('path');
export class UnpackedServer {
    constructor() {

    }


    async onRequest(req, res) {
        const fullUrl = `http://${req.headers.host + req.url}`;

        const url = new URL(fullUrl);

        if (url.pathname === '/mods/api/get-assets') {
            const assetsPath = url.searchParams.get('path') + '/assets/';
            const assets = this.getAssets(assetsPath);
            res.send(JSON.stringify(assets));
        }
    }

    getAssets(relativeFolderPath, allFiles = []) {
        
        const basePath = process.cwd();
        const baseFolder = path.join(basePath, relativeFolderPath);
        if (fs.existsSync(baseFolder)) {
            const files = fs.readdirSync(baseFolder);
            for (const file of files) {
                const filePath = path.join(baseFolder, file);
                const relativePath = path.join(relativeFolderPath, file);
                if (!fs.statSync(filePath).isFile()) {
                    this.getAssets(relativePath, allFiles);
                } else {
                    allFiles.push(relativePath.replace(/\\/g, '/'));
                }
            }
        }
        return allFiles;
    }
}