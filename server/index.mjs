import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const express = require('express');
const fetch = require('node-fetch');
const JSZip = require('../ccloader/js/lib/jszip.js');
import {PackedModServer} from "../ccloader/js/packedmodserver.mjs";

const packedServer = new PackedModServer(new JSZip);
packedServer.setFetch(fetch);

const app = express();
app.use('/', express.static(process.cwd()))
app.get('/mods/api/*', async function(req, res) {
    await packedServer.onRequest(req, res)
});

app.listen(3000);