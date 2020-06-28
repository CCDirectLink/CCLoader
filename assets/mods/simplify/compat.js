/**
 * 
 * @param {string} modDir 
 */
export async function apply(modDir) {
	const resp = await fetch(modDir.substr(7) + 'entries.json');
	const { entries } = await resp.json();
	const cc = getTree();
	Object.assign(window, {
		cc: cc,
		entries: entries,
	});
}

function getTree() {
	const cc = {
		ig: {
			bgm: ig.bgm,
			BGM_TRACK_LIST: ig.BGM_TRACK_LIST,
			saveSlotList: () => ig.storage.slots,
			interact: ig.interact,
			GUI: ig.gui,
			gameMain: ig.game,
			entityList: ig.ENTITY,
			baseEntity: ig.Entity,
			events: ig.EVENT_STEP,
			Font: ig.Font,
			combatActions: ig.ACTION_STEP,
			Storage: ig.Storage,
			storage: ig.storage,
			playerInstance: () => ig.game.playerEntity,
			getMapName: () => ig.game.mapName,
			BGM_SWITCH_MODE: ig.BGM_SWITCH_MODE,
			varNames: {
				gameMainLoadStart: 'loadStart',
				param: 'params',
				paramGetStat: 'getStat',
				gameMainSpawnEntity: 'spawnEntity',
				TeleportPosition: 'TeleportPosition',
				TeleportPositionFromJson: 'createFromJson',
				systemHasFocusLost: 'hasFocusLost',
				animation: 'animState',
				currentAnimation: 'currentAnim',
				mapName: 'mapName',
				entityData: 'coll',
				entityPosition: 'pos',
				entityKill: 'kill',
				run: 'run',
				proxies: 'proxies',
				proxyActions: 'rootStep',
				slowDownModifier: 'factor',
				innerGUI: 'gui',
				jump: 'doJump',
				AnimationState: 'AnimationState',
				gameMainTeleport: 'teleport',
				gameMainLoadMap: 'loadLevel',
				gameMainBeginLoadMap: 'preloadLevel',
				storageGlobals: 'globalData',
				currentState: 'currentState',
				BGMpath: 'track',
				Gui: 'GUI',
				addGui: 'addChildGui',
				anims: 'animations',
				image: 'image',
				tint: 'colorOverlays',
				empty: 'animMods',
				paramCurrentHp: 'currentHp',
				setTarget: 'setTarget',
				activate: 'activate',
			},
			GuiScreen: {
				varNames: {
					lines: 'names',
					CreditsObject: 'credits',
				}
			},
			Database: ig.database,
			TextCommand: ig.TextParser,
			DefaultSound: ig.Sound,
			LangLabel: ig.LangLabel,
			Gui: ig.GUI,
			cacheList: ig.cacheList,
			Image: ig.Image,
			Sound: ig.Sound,
			Track: ig.Track,
		},
		sc: {
			PlayerConfig: sc.PlayerConfig,
			EnemyType: sc.EnemyType,
			Inventory: sc.Inventory,
			inventory: sc.inventory,
			party: sc.party,
			playerModelInstance: sc.model,
			stats: sc.stats,
			fontsystem: sc.fontsystem,
			OPTIONS_DEFINITION: sc.OPTIONS_DEFINITION,
			OPTION_CATEGORY: sc.OPTION_CATEGORY,
			OptionsMenu: sc.OptionsTabBox,
			OptionsTabBox: sc.OptionsTabBox,
			varNames: {
				init: 'init',
				optionsTabBoxTab: 'tabs',
				optionsTabBoxTabArray: 'tabArray',
				optionsTabBoxRearrangeTabs: '_rearrangeTabs',
				optionsTabBoxCreateTabButton: '_createTabButton',
				optionsLoadGlobals: 'onStorageGlobalLoad',
				isInCombat: 'isCombatRankActive',
				autoSlotMiss: 'autoSlotMiss',
			},
			VoiceActor: sc.VA_CONFIG,
			VoiceActing: sc.voiceActing,
			SIDE: sc.MESSAGE_SIDES_OR_ALL,
			Message: {
				CLEAR_SIDE: sc.message.clearSide,
			},
			GetAreaInfo: sc.map.onStorageSave,
			Model: sc.Model,
			Combat: sc.Combat,
			COMBATANT_PARTY: sc.COMBATANT_PARTY,
			ButtonListBox: sc.ButtonListBox,
			SaveSlotButton: sc.SaveSlotButton,
		}
	};
    
	Object.assign(ig.game, {
		getLoadingState: () => ig.game.currentLoadingResource,
		LoadMap: () => ig.game.preloadLevel,
		CreateMap: () => ig.game.loadLevel,
	});
    
	Object.assign(ig.bgm, {
		varNames: {
			intro: 'introPath',
			loopEnd: 'loopEnd',
			introEnd: 'introEnd',
			bufferHandle: 'bufferHandle',
			endCallback: 'endCallback',
		},
		mapConfig: ig.BGM_DEFAULT_TRACKS,
	});
    
	Object.assign(ig.gui, {
		interact: {
			buttonManager: 'buttonInteract',
			button: 'buttonGroup',
		},
		setPosition: ig.gui.setPos,
		screenPosition: ig.gui.pos,
		GuiConfig: ig.gui.hook,
		GuiArray: ig.gui.buttons,
		renameTextButton: ig.gui.setText,
		addTextButton: ig.gui._createButton,
		callbackFunction: ig.gui.onButtonPress,
	});
    
	Object.assign(ig.LangLabel, {
		varNames: {
			langUid: 'langUid',
		}
	});
    
	Object.assign(sc.stats, {
		getStat: sc.stats.getMap,
	});
    
	Object.assign(sc.VA_CONFIG, {
		varNames: {
			Expressions: 'expressions',
			Sounds: 'sounds'
		}
	});

	return cc;
}