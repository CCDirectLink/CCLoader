declare namespace ccloader {
    /**
     * The base class for all mods that are loaded using the plugin system
     */
    export class Plugin {
        public readonly name: string;
        public readonly version: string;
        public readonly hidden: boolean;
        public readonly description?: string;
        public readonly assets?: string[];

        public readonly dependencies: {
            [name: string]: string;
        }
        
        public readonly preload?: () => Promise<void>;
        public readonly postload?: () => Promise<void>;
        public readonly prestart?: () => Promise<void>;
        public readonly main?: () => Promise<void>;

        /*
         * Set by ccloader
         */ 
        //get disabled(): boolean;

        public constructor(mods: Mod[]);

        /**
         * Called after all mods in the dependencies field are confirmed to be enabled.
         * @return If false is returned the mod will be disabled.
         */
        public checkDependencies(mods: Mod[]): boolean;
    }
}