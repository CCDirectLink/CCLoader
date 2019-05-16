(function() {
	function createCCLoaderVersionText() {
		const LOADER_NAME = 'CCLoader';

		const text = new sc.TextGui(LOADER_NAME + ' V' + versions.ccloader, {
			font: sc.fontsystem.tinyFont
		});
		
		text.hook.transitions = {
			DEFAULT: {
				state: {},
				time: 0.2,
				timeFunction: KEY_SPLINES.EASE
			},
			HIDDEN: {
				state: {
					alpha: 0
				},
				time: 0.2,
				timeFunction: KEY_SPLINES.LINEAR
			}
		};
		return text;
	}

	function callbackOverride(object, callbackFunctionName, newCallback) {
		const oldCallBackFunction = object[callbackFunctionName];
		object[callbackFunctionName] = function() {
			newCallback.apply(this, arguments);
			return oldCallBackFunction.apply(this, arguments);
		};
	}
	
	const versionTextTitleScreen = createCCLoaderVersionText();
	
	function onModelChange(object, modelMsg) {
		if (object == sc.model && modelMsg === sc.GAME_MODEL_MSG.STATE_CHANGED) {
			const currentStateName = object.isTitle() ? 'DEFAULT' : 'HIDDEN';
			if (this.hook.currentStateName !== currentStateName) {
				if(currentStateName === 'HIDDEN') {
					versionTextTitleScreen.doStateTransition('HIDDEN');	
				}
			}
		}
	}
	function bgCallback(sequenceMsg, label) {
		
		if (sequenceMsg === ig.SEQUENCE_MSG.LABEL_REACHED 
		      && label === 'IDLE') {
			versionTextTitleScreen.doStateTransition('DEFAULT');
		}
	}
	
	document.body.addEventListener('modsLoaded', () => {
		const titleScreenGui = ig.gui.guiHooks.filter((e) => e.gui instanceof sc.TitleScreenGui).pop();
		
		
		versionTextTitleScreen.setPos(2, 10);
		versionTextTitleScreen.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_BOTTOM);
		versionTextTitleScreen.doStateTransition('HIDDEN', true);

		titleScreenGui.gui.addChildGui(versionTextTitleScreen);

		callbackOverride(titleScreenGui.gui, 
			'modelChanged', 
			onModelChange);

		callbackOverride(titleScreenGui.gui.bgGui, 
			'callback',
			bgCallback);
		
		const pauseScreenGui = ig.gui.guiHooks.filter((e) => e.gui instanceof sc.PauseScreenGui).pop();
		const versionTextPauseScreen = createCCLoaderVersionText();
		
		versionTextPauseScreen.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_TOP);
		versionTextPauseScreen.setPos(0, 10);
		
		pauseScreenGui.gui.addChildGui(versionTextPauseScreen);
	});
})();
