import { ModLoader } from './ccloader.js';

window.onload = () => {
	const modloader = window.modloader = new ModLoader();
	modloader.startGame()
		.then()
		.catch(err => console.error('Something went wrong while loading the game', err));
};