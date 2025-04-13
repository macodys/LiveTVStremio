import fetch from 'node-fetch';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sdk = require('stremio-addon-sdk');
const { addonBuilder } = sdk;

const PORT = process.env.PORT || 3000;
const STREAM_URL = 'https://peugeot.yuyuim.shop/hls/JJJJ.m3u8';
const REFERER_HEADER = 'http://www.fawanews.com/';
const USER_AGENT_HEADER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

const app = express();

// Proxy playlist
app.get('/proxy/playlist.m3u8', async (req, res) => {
    try {
        console.log('➡️ Proxying playlist request');
        const response = await fetch(STREAM_URL, {
            headers: {
                'Referer': REFERER_HEADER,
                'User-Agent': USER_AGENT_HEADER
            }
        });
        response.body.pipe(res);
    } catch (err) {
        console.error('❌ Error proxying playlist:', err);
        res.status(500).send('Error fetching playlist');
    }
});

// Proxy segments
app.get('/proxy/:segment', async (req, res) => {
    try {
        const segmentUrl = STREAM_URL.replace('JJJJ.m3u8', req.params.segment);
        console.log(`➡️ Proxying segment request: ${segmentUrl}`);
        const response = await fetch(segmentUrl, {
            headers: {
                'Referer': REFERER_HEADER,
                'User-Agent': USER_AGENT_HEADER
            }
        });
        response.body.pipe(res);
    } catch (err) {
        console.error('❌ Error proxying segment:', err);
        res.status(500).send('Error fetching segment');
    }
});

// Stremio addon builder
const builder = new addonBuilder({
    id: "org.fawanews.live",
    version: "1.0.0",
    name: "FAWA Live Stream",
    description: "Live stream from fawanews.com with proxy",
    types: ["channel"],
    catalogs: [{
        type: "channel", // ✅ Make sure catalog type is "channel"
        id: "fawa_live_catalog",
        name: "FAWA Live TV",
        extra: []
    }],
    resources: [
        {
            name: "catalog", // ✅ name field required by SDK from GitHub
            types: ["channel"],
            idPrefixes: ["fawa_live_catalog"]
        },
        {
            name: "stream",
            types: ["channel"],
            idPrefixes: ["fawa_stream"]
        }
    ]
});

// Catalog handler
builder.defineCatalogHandler(() => {
    console.log('📦 Catalog requested');
    return Promise.resolve({
        metas: [{
            id: "fawa_stream",
            type: "channel", // ✅ Must match catalog type
            name: "Newcastle vs Manchester United",
            description: "Live match stream from fawanews.com"
        }]
    });
});

// Stream handler
builder.defineStreamHandler(({ id }) => {
    console.log(`🎥 Stream requested for: ${id}`);
    if (id === "fawa_stream") {
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        return Promise.resolve({
            streams: [{
                title: "FAWA Proxy Stream",
                url: `${baseUrl}/proxy/playlist.m3u8`
            }]
        });
    }
    return Promise.resolve({ streams: [] });
});

// Serve manifest.json
app.get('/manifest.json', (req, res) => {
    try {
        console.log('📜 Manifest requested');
        const manifest = builder.getInterface().manifest;
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(manifest));
    } catch (err) {
        console.error('❌ Error serving manifest.json:', err);
        res.status(500).send(err.toString());
    }
});

// Serve resource routes
app.get('/:resource/:type/:id/:extra?.json', (req, res) => {
    const { resource, type, id } = req.params;
    const extra = req.params.extra ? JSON.parse(req.params.extra) : {};
    console.log(`📡 Resource requested: ${resource}/${type}/${id}`);

    builder.getInterface().get(resource, type, id, extra)
        .then(response => {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(response));
        })
        .catch(err => {
            console.error(`❌ Error handling ${resource}/${type}/${id}:`, err);
            res.status(500).send(err.toString());
        });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    if (process.env.BASE_URL) {
        console.log(`🌍 Public URL: ${process.env.BASE_URL}/manifest.json`);
    } else {
        console.log('⚠️ BASE_URL not set. Set this in Railway variables for production!');
    }
});
