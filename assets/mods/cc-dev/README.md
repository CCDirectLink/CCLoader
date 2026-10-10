# CC Dev

An optional development mod for CCLoader. It watches unpacked mods that implement
`unload()` and `reload()`, and provides authenticated local HTTP evaluation in the
game's renderer. No loader-core patch is required.

## Enable

Install this directory as `assets/mods/cc-dev/` in your game, then launch CrossCode
with `CC_DEV=1` in its environment. Without this setting the mod does nothing.
For example, in PowerShell, from the game directory:

```powershell
$env:CC_DEV = '1'
Start-Process -FilePath ./CrossCode.exe
```

Watching and HTTP start after the loader's `modsLoaded` event. The server binds
only to `127.0.0.1`, selects an available port, and writes connection details and
a random bearer token to `.cc-dev-session.json` in the game directory. Keep this
file private and out of version control. It is removed on normal shutdown.
After a crash, close the old game process before removing a stale session file.
An existing session file is never overwritten.

- `CC_DEV_HTTP=0`: enable watching without the HTTP server.
- `CC_DEV_PORT=9223`: select a specific HTTP port instead of an available one.
- Browser-hosted games and Android are unsupported; Node/NW.js is required.

While CC Dev is enabled, **Ctrl+Shift+I** opens NW.js DevTools. This avoids F12
when Steam uses it for screenshots. The installed NW.js build must include
DevTools; if unavailable, CC Dev reports the error in the console.

## Plugin lifecycle

Implement both methods on the default-exported plugin class. Existing mods
without them keep their usual startup behavior and are not watched.

```js
export default class Example {
    constructor(mod) {
        this.mod = mod;
    }

    async poststart() {
        await this.reload({ reason: 'startup', changedFiles: [] });
    }

    async reload({ changedFiles } = {}) {
        this.onKey = event => console.log('key', event.code);
        window.addEventListener('keydown', this.onKey);
        // Install any other hooks/resources owned by this instance here.
    }

    async unload() {
        if (this.onKey) window.removeEventListener('keydown', this.onKey);
        this.onKey = null;
        // Restore hooks, remove observers, stop timers/audio, abort requests, etc.
    }
}
```

Constructors and module top-level code must have no game side effects. The class
must expose `unload` and `reload` as prototype methods, rather than assigning
them in its constructor. `unload()` must be safe after partial initialization
and safe to retry if its previous call failed. It must clean up effects from
all startup stages and manifest scripts owned by the mod.

An edit debounces for 200 ms. Reloads serialize per mod:

1. Import a fresh plugin entry URL and validate its class and methods.
2. Await the old instance's `unload({ reason: 'reload', changedFiles })`.
3. Construct a replacement with the same CCLoader `Mod` object.
4. Await its `reload({ reason: 'reload', changedFiles })`.
5. Publish the replacement as `mod.pluginInstance`.

Import/validation errors preserve the current instance. Failed old cleanup stops
replacement; the next edit/manual reload retries cleanup first. Failed new
initialization calls its `unload({ reason: 'failed-reload', changedFiles })` and
leaves the mod inactive. If that cleanup also fails, the instance is retained
for another cleanup attempt before any replacement is initialized.

The startup stages `preload`, `postload`, `prestart`, `main` and `poststart` are
not replayed. `poststart()` in the example invokes the same initialization used
for reload, but a mod can choose a different initial startup stage.

Directory watchers support atomic file saves and newly created subdirectories.
Symlink directories, `.git` and `node_modules` are skipped. Packed `.ccmod` mods
are skipped. Editing `ccmod.json` or `package.json` requires a game restart.
Watching does not unload dependent mods or refresh their references to exports.

Only the plugin entry's module URL is cache-busted. Static imported dependencies
retain browser module caching; changing those needs a restart or explicit
versioned imports managed by the mod. Asset changes trigger `reload()`, but the
mod owns refreshing images, sound, JSON, and other game caches. Repeated dynamic
imports retain module records, so restart during long development sessions.

## HTTP and console API

Every endpoint requires `Authorization: Bearer TOKEN`. Browser-origin requests
and unexpected Host headers are rejected. Request and response bodies are
limited to 1 MiB. No CORS access is provided.

| Endpoint | Body | Result |
| --- | --- | --- |
| `GET /status` | None | Game readiness and watched mod states/errors |
| `POST /reload` | `{"id":"example"}` | Waits for that mod's replacement |
| `POST /eval` | `{"code":"return ig.game.mapName;"}` | Evaluates an async function in the game renderer |

POST bodies must use `Content-Type: application/json`. Evaluation supports
`await` and explicit `return`, and has normal access to `window`, `ig`, `sc`,
Node integration, and a `dev` argument exposing `status()` and `reload(id)`.
Successful responses contain `{ ok: true, result, logs }`. Failures contain
`{ ok: false, error: { name, message, stack }, logs }` for eval, or an error
without logs for request failures. Undefined results are represented as `null`.
Circular objects, BigInts and oversized results return serialization errors;
return a small JSON-compatible projection of game objects.
Results otherwise use normal JSON serialization: undefined properties and
functions are omitted, and Maps/Sets do not preserve their entries.

The local `console` argument captures `log`, `info`, `warn`, `error` and `debug`
calls as bounded log entries. It does not replace the game's global console;
logs from independently called game functions still go to the normal console.

```powershell
$session = Get-Content ./.cc-dev-session.json -Raw | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($session.token)" }
Invoke-RestMethod "$($session.url)/status" -Headers $headers
Invoke-RestMethod "$($session.url)/eval" -Method Post -Headers $headers `
    -ContentType 'application/json' `
    -Body '{"code":"return { map: ig.game.mapName, mods: activeMods.map(m => m.name) };"}'
Invoke-RestMethod "$($session.url)/reload" -Method Post -Headers $headers `
    -ContentType 'application/json' -Body '{"id":"example"}'
```

In the game's developer console:

```js
window.ccDev.status();
await window.ccDev.reload('example');
```

Evaluations run serially. After 10 seconds an evaluation returns HTTP 504, but
its code may still run; later evaluations wait for it to settle. This cannot
interrupt a synchronous infinite loop. Reload requests use per-mod queues and
are not serialized with eval: await `dev.reload(id)` inside eval when code
depends on replacement finishing.

On window unload, watchers and the HTTP server close. Stopping the utility does
not unload successfully running mods. Do not expose its port to other machines.

## DevTools Protocol alternative

The HTTP service is optional. NW.js remote debugging can also evaluate code and
invoke `window.ccDev.reload()` when supported by your installed NW.js build.
Launch with `--remote-debugging-port=9222`, attach a CDP client to the game
renderer, and use `Runtime.evaluate` with `awaitPromise: true`. Keep the debugger
on loopback. See [NW.js remote debugging](https://docs.nwjs.io/For%20Users/Debugging%20with%20DevTools/)
and [CDP Runtime.evaluate](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate).

## Validation

Syntax checks can be run with Node:

```powershell
node --check assets/mods/cc-dev/plugin.js
node --check assets/mods/cc-dev/reloader.js
node --check assets/mods/cc-dev/http.js
```

An independently authored smoke check requires a genuine running game with
CC Dev enabled (Node 22 or newer for the client):

```powershell
node tests/cc-dev-live.mjs 'C:/Program Files (x86)/Steam/steamapps/common/CrossCode'
# Optional: also stop CC Dev and verify removal of its session credentials.
node tests/cc-dev-live.mjs 'C:/Program Files (x86)/Steam/steamapps/common/CrossCode' --shutdown
```

This script never substitutes a fake game/server and does not exercise plugin
replacement. Those checks require a real participating mod.

For runtime validation, use a real CrossCode session: enable CC Dev, inspect
`/status`, evaluate a small game-state projection, and edit a participating mod's
plugin entry. Verify that old effects disappear and replacement effects appear
once, invalid JavaScript preserves the current instance, failed initialization
cleans up, and another edit recovers. Verify `.cc-dev-session.json` disappears
when the game closes. Syntax checks do not establish this runtime behavior.
