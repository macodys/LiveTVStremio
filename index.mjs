import fetch from 'node-fetch';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sdk = require('stremio-addon-sdk');
const { addonBuilder } = sdk;

const PROXY_PORT = process.env.PORT || 3000;
const STREAM_URL = 'https://peugeot.yuyuim.shop/hls/JJJJ.m3u8';
const REFERER_HEADER = 'http://www.fawanews.com/';
const USER_AGENT_HEADER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

// Initialize Express app
const app = express();

// Logging for startup
console.log('✅ Starting FAWA Stremio Addon...');

// Proxy .m3u8 playlist
app.get('/proxy/playlist.m3u8', async (req, res) => {
    try {
        console.log('➡️  Proxying playlist request');
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

// Proxy .ts segment files
app.get('/proxy/:segment', async (req, res) => {
    try {
        const segmentUrl = STREAM_URL.replace('JJJJ.m3u8', req.params.segment);
        console.log(`➡️  Proxying segment request: ${segmentUrl}`);
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

// Initialize Stremio Addon
const builder = new addonBuilder({
    id: "org.fawanews.live",
    version: "1.0.0",
    name: "FAWA Live Stream",
    description: "Live stream from fawanews.com with proxy",
    types: ["tv"],
    catalogs: [{
        type: "tv",
        id: "fawa_live_catalog",
        name: "FAWA Live TV",
        extra: []
    }],
    resources: ["catalog", "stream"]
});

// Catalog handler
builder.defineCatalogHandler(() => {
    console.log('📦 Catalog requested');
    return Promise.resolve({
        metas: [{
            id: "fawa_stream",
            type: "tv",
            name: "Newcastle vs Manchester United",
            poster: "https://upload.wikimedia.org/wikipedia/en/7/7a/Newcastle_United_Logo.svg",
            background: "https://upload.wikimedia.org/wikipedia/commons/6/66/Old_Trafford_inside_20060726_1.jpg",
            description: "Live match stream from fawanews.com"
        }]
    });
});

// Stream handler
builder.defineStreamHandler(({ id }) => {
    console.log(`🎥 Stream requested for: ${id}`);
    if (id === "fawa_stream") {
        const baseUrl = process.env.BASE_URL || `http://localhost:${PROXY_PORT}`;
        return Promise.resolve({
            streams: [{
                title: "FAWA Proxy Stream",
                url: `${baseUrl}/proxy/playlist.m3u8`
            }]
        });
    }
    return Promise.resolve({ streams: [] });
});

// Serve manifest.json properly
app.get('/manifest.json', (req, res) => {
    try {
        console.log('📜 Manifest requested');
        const manifest = builder.manifest; // ✅ FIXED
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(manifest));
    } catch (err) {
        console.error('❌ Error serving manifest.json:', err);
        res.status(500).send(err.toString());
    }
});


// Serve Stremio resources (catalog, stream)
app.get('/:resource/:type/:id/:extra?.json', (req, res) => {
    const { resource, type, id } = req.params;
    const extra = req.params.extra ? JSON.parse(req.params.extra) : {};
    console.log(`📡 Resource requested: ${resource} / ${type} / ${id}`);
    builder.getInterface().get(resource, type, id, extra).then(response => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(response));
    }).catch(err => {
        console.error('❌ Error serving resource:', err);
        res.status(500).send(err.toString());
    });
});

// Start server
app.listen(PROXY_PORT, () => {
    console.log(`✅ Server running at http://localhost:${PROXY_PORT}`);
    if (process.env.BASE_URL) {
        console.log(`🌍 Public URL: ${process.env.BASE_URL}/manifest.json`);
    } else {
        console.log('⚠️  BASE_URL not set. Make sure to set BASE_URL in Railway variables!');
    }
});
