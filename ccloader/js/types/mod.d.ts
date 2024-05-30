declare namespace ccloader {
    /**
     * The base class for all mods that are loaded using the plugin system
     */
    export class Mod {
        readonly file: string;

        private constructor(modloader, file, plugin);

	    load(): Promise<void>;
    	loadPrestart(): Promise<void>;
    	loadPreload(): Promise<void>;
    	loadPostload(): Promise<void>;
    	loadPlugin(): Promise<void>;
	    onload(): Promise<void>;

        get name(): string | undefined;
        get displayName(): string | undefined;
        get description(): string | undefined;
        get assets(): string[] | undefined;
        get dependencies(): {[name: string]: string} | undefined;
        get version(): string | undefined;
        get module(): boolean | undefined;
        get hidden(): boolean | undefined;
        get main(): string | undefined;
        get preload(): string | undefined;
        get postload(): string | undefined;
        get prestart(): string | undefined;
        get plugin(): string | undefined;

        get baseDirectory(): string;
        get isEnabled(): boolean;

	    getAsset(path: string): string | string[] | undefined;
        setAsset(original: string, newPath: string | string[]): void;
        
        /**
         * Adds a patch to the mod.
         * @param original The original file path without .patch
         * @param patchPath The patch file path with .patch
         */
        addPatch(original: string, ...patchPath: string[]): void;
    }
}
