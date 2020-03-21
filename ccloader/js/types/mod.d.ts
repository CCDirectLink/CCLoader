declare namespace ccloader {
    /**
     * The base class for all mods that are loaded using the plugin system
     */
    export class Mod {
        readonly file: string;
        readonly baseDirectory: string;

        private constructor(modloader, baseDirectory: string);

	    load(): Promise<void>;
    	loadPrestart(): Promise<void>;
    	loadPreload(): Promise<void>;
    	loadPostload(): Promise<void>;
    	loadPlugin(): Promise<void>;
	    onload(): Promise<void>;

        get name(): string | undefined;
        get displayedName(): string | undefined;
        get description(): string | undefined;
        get assets(): string[] | undefined;
        get dependencies(): {[name: stirng]: string} | undefined;
        get version(): string | undefined;
        get module(): boolean | undefined;
        get hidden(): boolean | undefined;
        get main(): string | undefined;
        get preload(): string | undefined;
        get postload(): string | undefined;
        get prestart(): string | undefined;
        get plugin(): string | undefined;

        get isEnabled(): boolean;

	    getAsset(path: string): string | undefined;
        setAsset(original: string, newPath: string): void;
    }
}
