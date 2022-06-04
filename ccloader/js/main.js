import './normalize.js';
import { ModLoader } from './ccloader.js';

if (window.process && window.process.env) {
	const envVar = process.env.CCLOADER_OVERRIDE_MAIN_URL;
	if (envVar) {
		window.location.replace(new URL(envVar, window.location.origin));
	}
}

window.onload = () => {
	const modloader = new ModLoader();
	modloader.startGame()
		.then()
		.catch(err => console.error('Something went wrong while loading the game', err));
};
