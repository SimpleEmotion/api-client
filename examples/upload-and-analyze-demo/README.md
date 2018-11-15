# Simple Emotion API Demo
API demo that shows how to upload an audio file, start analysis, and create a basic server to catch incoming
webhooks. Two scripts are provided. One uploads an audio file and the other starts a basic HTTP server that
listens for webhooks from Simple Emotion.

This module exports the webhook handler function and two CLI operations.

## Module Useage

If the `index.js` file is loaded as a module, the HTTP server's request handler function for handling incoming
webhooks is exposed as `handler`.

```
const { handler } = require( './index.js' );
```

## CLI Useage

### Upload
```
npm run upload <AUDIO_FILE_URI>
```

Creates a new Simple Emotion audio object and starts an upload operation (`transload-audio`).

EX: `npm run upload https://cdn.simpleemotion.com/audio/calls/steve-brown.wav`

### Server
```
npm run server <WEBHOOK_SERVER_URL>
```

Starts a basic HTTP server that creates a webhook for your organization and listens for
incoming operation complete events. If the server catches an upload complete event (`transload-audio`)
it will queue up an analyze audio operation (`classify-transcript`). If the server catches a
`classify-transcript` it will download the analysis results to a local file.

EX: `npm run server http://example.com/webhook`
