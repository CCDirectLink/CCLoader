(function() {
	function createCCLoaderVersionText() {
		const LOADER_NAME = "CCLoader";
	 
		let text = new cc.sc.Text(LOADER_NAME + " V" + versions.ccloader, {
			font: cc.sc.fontsystem.tiny
		});
		text[entries.setPosition](2, 10);
		text[entries.setAlignment](6, 3);
		
		text[entries.GuiConfig][entries.transition] = {
            DEFAULT: {
                state: {},
                time: 0.2,
                [entries.keySpline] : KEY_SPLINES.EASE
            },
            HIDDEN: {
                state: {
                    alpha: 0
                },
                time: 0.2,
                [entries.keySpline]: KEY_SPLINES.LINEAR
            }
        };
		return text;
	}
	
	document.body.addEventListener("modsLoaded", () => {
		let titleBG = cc.ig.GUI.menues.filter((e) => e[entries.GUI] instanceof cc.sc.TitleScreenBG).pop();
		if(!titleBG) {
			throw new Error('Could not find titleBG');
		}
		let versionText = createCCLoaderVersionText();
		versionText[entries.setGuiStateTransition]("HIDDEN", h);
		
		titleBG[entries.GUI][entries.addGui](versionText);
		
		let oldGuiCallback = titleBG[entries.GUI][entries.observerCallback];
		
		titleBG[entries.GUI][entries.observerCallback] = function(object,eventCode) {
			// eventCode === CHANGED_STATE
			if(object == cc.sc.playerModelInstance && eventCode === 0) {
				let currentTransition = cc.sc.playerModelInstance[entries.isMainMenu]() ? "DEFAULT" : "HIDDEN";
				if(this[entries.GuiConfig][entries.currentTransition] != currentTransition) {
					versionText[entries.setGuiStateTransition]("HIDDEN");
				}
			}	
			oldGuiCallback.apply(this, arguments);
		}
		

		let oldTitleCallback = titleBG[entries.GUI][entries.titleParallax][entries.callback];

		titleBG[entries.GUI][entries.titleParallax][entries.callback] = function(transitionState, transitionType) {
			// transitionState === ADD (my guess)
			if(transitionState === 1 && transitionType === "IDLE") {
				versionText[entries.setGuiStateTransition]("DEFAULT");	
			}
			oldTitleCallback.apply(this, arguments);
		}
	});
	

})()
