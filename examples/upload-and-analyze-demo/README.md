# Simple Emotion API Demo
API demo that shows how to upload an audio file, start analysis, and create a basic server to catch incoming
webhooks. Two scripts are provided. One uploads an audio file and the other starts a basic HTTP server that
listens for webhooks from Simple Emotion.

This module exports the webhook handler function and two CLI operations.

## Docker

### Server
```
docker run -it --rm \
       -p <HOST_PORT>:80 \
       -v <HOST_OUTPUT_DIR>:/mnt/analyses \
       -v <HOST_CONFIG_FILE>:/home/app/config.json \
       simpleemotion/api-client-demo:latest \
       server <WEBHOOK_SERVER_URL>
```

Example:
```
docker run -it --rm \
       -p 80:80 \
       -v $(pwd)/analyses:/mnt/analyses \
       -v $(pwd)/config.json:/home/app/config.json \
       simpleemotion/api-client-demo:latest \
       server http://example.com/webhook
```

### Upload
```
docker run -it --rm \
       -v <HOST_CONFIG_FILE>:/home/app/config.json \
       simpleemotion/api-client-demo:latest \
       upload <AUDIO_FILE_URL>
```

Example:
```
docker run -it --rm \
       -v $(pwd)/config.json:/home/app/config.json \
       simpleemotion/api-client-demo:latest \
       upload https://cdn.simpleemotion.com/audio/calls/steve-brown.wav
```

Output:
```
{"audio":{"_id":"80137453-b808-40f5-9d58-72cc704176d2"},"operation":{"_id":"c481302e-b20c-4a98-be07-dfd286dd4e37"}}
```

## CLI

### Server
```
npm run server <WEBHOOK_SERVER_URL>
```

Starts a basic HTTP server that creates a webhook for your organization and listens for
incoming operation complete events. If the server catches an upload complete event (`transload-audio`)
it will queue up an analyze audio operation (`classify-transcript`). If the server catches a
`classify-transcript` it will download the analysis results to a local file.

EX: `npm run server http://example.com/webhook`

### Upload
```
npm run upload <AUDIO_FILE_URL>
```

Creates a new Simple Emotion audio object and starts an upload operation (`transload-audio`).

EX: `npm run upload https://cdn.simpleemotion.com/audio/calls/steve-brown.wav`


## Node Module

If the `index.js` file is loaded as a module, the HTTP server's request handler function for handling incoming
webhooks is exposed as `handler`.

```
const { handler } = require( './index.js' );
```
