module.exports = class ZipHandler {
    constructor(zip) {
        this.zip = zip;
    }


    async loadZip(zipPath, obj) {
        const root = this._createFolders(this.zip, zipPath.split('/'));
        await root.loadAsync(obj, {createFolders: true});
    }

    listFiles(zipPath) {
        const filePaths = [];
        const folderEntry = this._createFolders(this.zip, [...zipPath.split('/'), 'assets']);
        folderEntry.forEach((relativePath, file) => {
            if (!file.dir) {
                filePaths.push(pathToAssets + relativePath);
            }
        });
        return filePaths;
    }

    async getAsset(zipPath, type = 'arraybuffer') {
        const resource = this.zip.files[zipPath];
        if (!resource) {
            return undefined;
        }
        return resource.async(type);
    }

    hasPath(aPath) {
        return !!this.zip.files[aPath];
    }

    _createFolders(root, folderArr) {
        for (const folder of folderArr) {
            root = root.folder(folder);
        }
        return root;
    }

}