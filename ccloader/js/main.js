import './normalize.js';
import { ModLoader } from './ccloader.js';

if (window.process) {
	var envVar = process.env.CCLOADER_OVERRIDE_MAIN_URL;
	if (envVar) window.location.replace(envVar);
}

window.onload = () => {
	const modloader = window.modloader = new ModLoader();
	modloader.startGame()
		.then()
		.catch(err => console.error('Something went wrong while loading the game', err));
};
