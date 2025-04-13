import sdk from 'stremio-addon-sdk';
import express from 'express';
import request from 'request';

const { addonBuilder } = sdk;

// Env variables for deployment
const PROXY_PORT = process.env.PORT || 3000; // Railway uses dynamic port
const STREAM_URL = 'https://peugeot.yuyuim.shop/hls/JJJJ.m3u8';
const REFERER_HEADER = 'http://www.fawanews.com/';
const USER_AGENT_HEADER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

// Init Express app
const app = express();

// Proxy .m3u8 playlist
app.get('/proxy/playlist.m3u8', (req, res) => {
    request.get({
        url: STREAM_URL,
        headers: {
            'Referer': REFERER_HEADER,
            'User-Agent': USER_AGENT_HEADER
        }
    }).pipe(res);
});

// Proxy .ts segments
app.get('/proxy/:segment', (req, res) => {
    const segment = req.params.segment;
    const segmentUrl = STREAM_URL.replace('JJJJ.m3u8', segment);

    request.get({
        url: segmentUrl,
        headers: {
            'Referer': REFERER_HEADER,
            'User-Agent': USER_AGENT_HEADER
        }
    }).pipe(res);
});

// Set up Stremio Addon
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

// Catalog Handler
builder.defineCatalogHandler(() => {
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

// Stream Handler (points to your public proxy)
builder.defineStreamHandler(({ id }) => {
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

// Express route for manifest.json (Stremio expects this!)
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(builder.getInterface().getManifest()));
});

// Express route for stremio resource handlers
app.get('/:resource/:type/:id/:extra?.json', (req, res) => {
    const { resource, type, id } = req.params;
    const extra = req.params.extra ? JSON.parse(req.params.extra) : {};
    builder.getInterface().get(resource, type, id, extra).then(response => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(response));
    }).catch(err => {
        res.status(500).send(err.toString());
    });
});

// Start server
app.listen(PROXY_PORT, () => {
    console.log(`✅ Server running on port ${PROXY_PORT}`);
});
