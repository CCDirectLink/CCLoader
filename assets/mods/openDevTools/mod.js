if (process.versions.nw.startsWith('0.8.3') || process.versions['nw-flavor'] === 'sdk') {
    require('nw.gui').Window.get().showDevTools();
}