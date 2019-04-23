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
                p: KEY_SPLINES.EASE
            },
            HIDDEN: {
                state: {
                    alpha: 0
                },
                time: 0.2,
                p: KEY_SPLINES.LINEAR
            }
        };
		return text;
	}
	const onModsLoaded = function() {
		let titleBG = cc.ig.GUI.menues.filter((e) => e[entries.GUI] instanceof cc.sc.TitleScreenBG).pop();
		if(!titleBG) {
			throw new Error('Could not find titleBG');
		}
		let versionButton = createCCLoaderVersionText();
		versionButton[entries.setGuiStateTransition]("HIDDEN", h);
		
		titleBG[entries.GUI][entries.addGui](versionButton);
		let oldC = titleBG[entries.GUI][entries.observerCallback];
		titleBG[entries.GUI][entries.observerCallback] = function(c,d) {
			if(c == cc.sc.playerModelInstance && d === 0) {
				let currentTransition = cc.sc.playerModelInstance[entries.isMainMenu]() ? "DEFAULT" : "HIDDEN";
				if(this[entries.GuiConfig][entries.currentTransition] != currentTransition) {
					versionButton[entries.setGuiStateTransition]("HIDDEN");
				}
			}	
			oldC.apply(this, arguments);
		}
		

		var oldCallback = titleBG[entries.GUI][entries.titleParallax][entries.callback];

		titleBG[entries.GUI][entries.titleParallax][entries.callback] = function(a,b) {
			
			if(a === 1 && b === "IDLE") {
				versionButton[entries.setGuiStateTransition]("DEFAULT");	
			}
			oldCallback.apply(this, arguments);
		}
		document.body.removeEventListener("modsLoaded", onModsLoaded);
	};

	document.body.addEventListener("modsLoaded", onModsLoaded);
})()
