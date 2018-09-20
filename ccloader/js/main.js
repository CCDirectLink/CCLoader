import { ModLoader } from './ccloader.js';

window.onload = () => {
	const modloader = new ModLoader();
	modloader.startGame();
};