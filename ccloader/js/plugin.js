/**
 * The base class for all mods that are loaded using the plugin system
 */
export class Plugin {
	constructor() {
		this.version = '0.0.0';
		this.hidden = false;
		this.disabled = false;
	}
    
	checkDependencies() {
		return true;
	}
}
window.Plugin = Plugin;