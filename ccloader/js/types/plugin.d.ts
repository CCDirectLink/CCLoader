declare namespace ccloader {
    /**
     * The base class for all mods that are loaded using the plugin system
     */
    export class Plugin {
        public readonly preload?: () => Promise<void>;
        public readonly postload?: () => Promise<void>;
        public readonly prestart?: () => Promise<void>;
        public readonly main?: () => Promise<void>;

        public constructor(mod: Mod);
    }
}
