import './normalize.js';
import { ModLoader } from './ccloader.js';

if (window.process) {
	const envVar = process.env.CCLOADER_OVERRIDE_MAIN_URL;
	if (envVar) {
		window.location.replace(envVar);
	}
}

const modloader = window.modloader = new ModLoader();

function reloadGame() {
	console.log('Game loaded');
	modloader.startGame()
		.then()
		.catch(err => console.error('Something went wrong while loading the game', err));
}


window.onload = function() {
	reloadGame();
}