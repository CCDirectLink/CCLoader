[![Discord Server](https://img.shields.io/discord/382339402338402315.svg?label=Discord%20Server)](https://discord.gg/3Xw69VjXfW)

# CCLoader
A Modloader for CrossCode written in JavaScript.

It loads mods for CrossCode from `assets/mods/`, and also gives you the option to enable or disable installed mods.

## Installation 

First, locate the CrossCode installation folder. If you play the game through Steam, you can do that by clicking on `Steam > Library > CrossCode > Manage > Properties > Local Files > [Browse...]`, which will open the games installation folder for you. All relative paths here are relative to this folder.

1. Download the [latest release](https://github.com/CCDirectLink/CCLoader/releases/latest) (one of the files listed in the **Assets** section).
2. Unzip the file.
3. Backup `package.json`, for example by renaming it to `package.json.bak`.
4. Copy the contents of the folder into your CrossCode installation folder and merge folders when asked. This should add the following files to your game files: `assets/mods/`, `ccloader/`, `mods.json` (and `README.md`, `.gitignore` although they *are not* needed). It will also **overwrite** `package.json`.

The installation was successful, when you see the text »Loading Game« on the initial loading screen of the game, and find a new »Mods« tab in the Options, which shows you all installed Mods, their versions, and an option to enable/disable single mods.

If the game doesn't start after CCLoader was installed, that might be due to the new `package.json` file. You can try restoring your old `package.json` file, and just set `"main"` to `"ccloader/index.html"` (which is the entrypoint to starting CrossCode with CCLoader enabled). It shoule look like this: `"main": "ccloader/index.html",`.

If you experience any further issues with installing CCLoader, feel free to ask us in the Discord linked at the top.

## Installing a mod

To install a mod, place the unzipped folder, or the **not unzipped** `.ccmod` file in `assets/mods/`, and CCLoader will load it automatically on the next start!

Uninstalling a mod is as simple as removing it's folder or file from `asstes/mods/`, although you can also disable the mods using CCLoader in the Mods tab in the Options menu.

## Uninstalling CCLoader

In order to uninstall CCLoader, remove the following files and directories and restore the original `package.json`. If you lost the original file, and play the game through Steam, you can also restore it by validating file integrity through `Steam > Library > CrossCode > Manage > Properties > Local Files > [Verify integrity of game files...]`.

* `assets/mods/`
* `ccloader/`
* `mods.json`
* `README.md`
* `.gitignore`
* `package.json`
