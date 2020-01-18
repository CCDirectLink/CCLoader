import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const express = require('express');
const fetch = require('node-fetch');
const JSZip = require('../ccloader/js/lib/jszip.js');
import {PackedModServer} from "../ccloader/js/packedmodserver.mjs";
import {UnpackedServer} from "./unpackedserver.mjs";

const unpackedServer = new UnpackedServer;

const packedServer = new PackedModServer(new JSZip);
packedServer.setFetch(fetch);

const app = express();
app.use('/', express.static(process.cwd()))
app.get('/mods/api/*', async function(req, res) {
    const fullUrl = `http://${req.headers.host + req.url}`;

    const url = new URL(fullUrl);
    if (url.searchParams.get('type') === 'unpacked') {
        await unpackedServer.onRequest(req, res);
    } else {
        await packedServer.onRequest(req, res);
    }
});

app.listen(3000);