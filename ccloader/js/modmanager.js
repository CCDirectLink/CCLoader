
import { Mod } from './mod.js';
import { PackedMod } from './packedmod.js'; 



const path = require('path');
const fs = require('fs');
export class ModManager {
    constructor(filemanager) {
        this.filemanager = filemanager;
        this.modsList = [];
    }

    async initialize() {
        this.modsList = await this._getAllMods();
    }

    /**
     *  Returns all available mods
     * @returns {Mod[]} 
     */
    async getAllMods(modloader) {
        const mods = [];
        const modFiles = this.modsList;

        /** @type {Mod[]} */

        for (const {path: modPath, packed} of modFiles) {
            
            let mod;
            const modPackagePath = path.join(modPath, 'package.json');
            if (packed) {
                mod = new PackedMod(modloader, modPackagePath);
            } else {                
                mod = new Mod(modloader, modPackagePath);
            }
            await mod.loadManifest();
            mods.push(mod);
        }

		return mods;
    }

    /**
     * Returns all available mods information
     * @returns {{path: string, packed: boolean}[]}
     */
    async _getAllMods() {
        let modsList = [];
        if (window.isBrowser) {
            try {

                modsList = JSON.parse(this.filemanager.getResource('mods.json'));
            } catch (e) {}
        } else {
            let unpackedList = await this.filemanager.getAllModsFiles();
            unpackedList = unpackedList.map((modPath) => { return {path: path.join(modPath, '..'), packed: false}});
            let packedList = await this._findPackedMods(process.cwd(), 'assets/mods/');
            packedList = packedList.map((modPath) => {return {path: modPath, packed: true}});
            modsList.push(...packedList, ...unpackedList);
        }
        return modsList;
    }

    /**
     * Returns the path to files with .ccmod extensions in dir
     * @param {string} dir to look in 
     * @returns {string[]}
     */
    async _findPackedMods(baseDir, relativeDir) {
        const files = fs.readdirSync(path.join(baseDir, relativeDir));
        const fileList = [];
        for (const file of files) {
            if (file.endsWith('.ccmod')) {
                fileList.push(path.join(relativeDir, file));
            }
        }
        return fileList;
    }
}