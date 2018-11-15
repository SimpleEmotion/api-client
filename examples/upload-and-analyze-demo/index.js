'use strict';

const { promisify: p } = require( 'util' );
const config = require( './config' );
const SEAPIClient = require( '@simple-emotion/api-client' );
const uuidV4 = require( 'uuid/v4' );
const fs = require( 'fs' );
const path = require( 'path' );
const express = require( 'express' );
const crypto = require( 'crypto' );
const bufferEq = require( 'buffer-equal-constant-time' );
const request = require( 'request' );

const CALLBACK_SECRET = config.secret || 'SUPER SECRET';
const OWNER = config.owner;
const STORAGE_DIR = path.resolve( config.server.storagePath );

// Set up api
const SEAPI = SEAPIClient(
  config.api.credentials.client_id,
  config.api.credentials.client_secret,
  {
    host: config.api.url,
    scope: [
      'oauth2',
      'callcenter',
      'operation',
      'storage',
      'webhook'
    ]
  }
);

module.exports = handler;

if ( require.main === module ) {

  const type = process.argv[ 2 ];
  const uri = process.argv[ 3 ];

  if ( !type || !uri ) {
    throw new Error( `Must specify ${type ? 'CLI operation type' : 'URI'}.` );
  }

  switch ( type ) {
    case 'server':
      server( uri ).then().catch( err => {
        console.error( err );
        process.exit( 1 );
      } );
      break;
    case 'upload':
      upload( uri ).then( result => {
        console.log( `Audio uploaded. Audio _id: ${result.audio._id}. Operation _id: ${result.operation._id}.` )
        process.exit( 0 );
      } ).catch( err => {
        console.error( err );
        process.exit( 1 );
      } );
      break;
    default:
      throw new Error( 'Unsupported CLI operation type. Refer to README for useage examples.' );
  }

}

// Basic webhook handler. NOTE: ignores request signature validation. See docs for proper webhook handling https://docs.simpleemotion.com/docs/handling-webhooks
async function handler( req, res, next ) {
  try {

    // Extract signature and payload from request for verification
    const signature = req.get( 'X-SE-Signature' ) || '';
    const payload = JSON.stringify( req.body || '' );

    // Compute signature from payload
    const computed_signature = sign( CALLBACK_SECRET, payload );

    // Securely verify signatures match
    if ( !equal( signature, computed_signature ) ) {
      res.statusCode = 200;
      res.write( 'Signature mismatch. Received invalid webhook.' );
      return res.end();
    }

    // Response must echo webhook challenge
    res.set( 'X-SE-Challenge', req.get( 'X-SE-Challenge' ) );

    // Extract event
    const event_type = req.body.event.type;

    // Not an operation complete event so we can ignore it in this demo.
    if ( event_type !== 'operation.complete' ) {
      console.log( 'Ignoring event we dont care about:', req.body.event.type );
      res.statusCode = 200;
      return res.end();
    }

    const data = req.body.data;

    // Get the operation to check result
    const { operation } = await p( SEAPI.operation.v2.get )( data );

    if ( operation.error ) {
      console.log( 'Operation failed!' );
      console.error( operation.error );
      res.statusCode = 200;
      return res.end();
    }

    if ( operation.type === 'transload-audio' ) {
      await analyzeAudio( operation.parameters.audio_id );
      console.log( `Started classify-transcript operation for audio _id: ${operation.parameters.audio_id}.` );
      res.statusCode = 200;
      return res.end();
    }

    else if ( operation.type === 'classify-transcript' ) {

      const { document } = await p( SEAPI.storage.v2.document.getLink )( { document: operation.result.document.transcript } );

      // If we are running it NOT in GCF then download the JSON data of the analysis file
      // Will close request because downloading data could time out req
      if ( !process.env.GCP_PROJECT ) {
        await downloadAnalysis( document.link, operation.parameters.audio_id );
        console.log( `Analysis data downloaded to ${generateLocalFilename( operation.parameters.audio_id )}` );
      }

    }

    res.statusCode = 200;
    res.end();

  } catch ( err ) {
    if ( !err.code ) {
      err = {
        code: 500,
        err: err.message
      };
    }

    res.statusCode = err.code;
    res.json( err );
    res.end();
  }
}

// Start a webhook basic handler server
async function server( uri ) {
  // Ensure that a webhook exists for the specified URI
  console.log( '[!] Ensuring callback webhook.' );
  await ensureWebhook( uri );

  // If we are running it NOT in GCF then make sure the storage directory exists
  if ( !process.env.GCP_PROJECT ) {
    await ensureStorageDirectory();
  }

  // Create an express server
  console.log( '[!] Initializing HTTP server.' );
  const app = express();
  const server = require( 'http' ).createServer( app );

  console.log( '[!] Configuring HTTP server.' );
  app.use( require( 'body-parser' ).json( { strict: true } ) );

  // Handle incoming webhook requests
  app.post( '/', handler );

  console.log( '[!] Starting web server.' );
  const port = config.server.port;
  server.listen( port );

}

// Upload an audio file from a URI
async function upload( url, tags ) {

  // Add audio file
  const { audio } = await p( SEAPI.storage.v2.audio.add )(
    {
      audio: {
        name: uuidV4(),
        owner: OWNER,
        metadata: {
          speakers: [
            { _id: 'speakerCh0', role: 'customer' },
            { _id: 'speakerCh1', role: 'agent' }
          ]
        }
      }
    }
  );

  // Upload raw audio data
  const { operation } = await p( SEAPI.storage.v2.audio.uploadFromUrl )(
    {
      audio: {
        _id: audio._id,
        owner: OWNER
      },
      url: url,
      operation: {
        tags: [ `audio_id=${audio._id}`, ... ( tags || [] ) ]
      }
    }
  );

  return { audio: { _id: audio._id }, operation: { _id: operation._id } };

}

// Buffer equals
function equal( a, b ) {
  return bufferEq( Buffer.from( a ), Buffer.from( b ) );
}

// Compute signature
function sign( secret, data ) {
  return crypto.createHmac( 'sha1', secret ).update( data ).digest( 'hex' );
}

// Ensure that a webhook exists for the specified uri and owner from config
async function ensureWebhook( uri ) {
  const webhook = await p( SEAPI.webhook.v1.list )(
    {
      webhook: {
        owner: OWNER,
        event: { type: 'operation.complete' },
        states: { enabled: true }
      }
    }
  ).then( result => result.webhooks.find( w => w.url === uri ) );

  if ( webhook ) {
    return webhook;
  }

  // Set up webhook for operation.complete event
  return await p( SEAPI.webhook.v1.add )(
    {
      webhook: {
        owner: OWNER,
        event: { type: 'operation.complete' },
        url: uri,
        secret: CALLBACK_SECRET
      }
    }
  ).then( result => result.webhook );
}

// Start a classify transcript operation for the specified audio id
async function analyzeAudio( audioId ) {
  // Start up an operation
  return await p( SEAPI.callcenter.v2.transcript.classify )(
    {
      audio: {
        _id: audioId,
        owner: OWNER
      },
      operation: {
        config: {
          'transcribe-audio': {
            redact: false, // Set to true to scrub any numbers that may contain personal data
            languageCode: 'en-US' // Change the transcription language with this
          }
        },
        tags: [
          'audio._id=' + audioId
        ]
      }
    }
  );
}

// Check if storage directory exists and make it if it does not
async function ensureStorageDirectory() {
  try {
    // Check if storage directory exists
    await p( fs.access )( STORAGE_DIR, fs.constants.R_OK );
  } catch ( err ) {
    // Directory doesn't exist so make it
    await p( fs.mkdir )( STORAGE_DIR );
  }
}

// Download the contents of the URL to a local file
async function downloadAnalysis( url, audioId ) {
  return new Promise( ( resolve, reject ) => {

    let returned = false;

    const done = err => {
      if ( !returned ) {

        returned = true;

        err ? reject( err ) : resolve();

      }
    };

    // Get request to the URL
    request( { url } )
      .on( 'error', done )
      .on( 'response', read => {

        read.pause();

        if ( read.statusCode >= 300 ) {
          return done( new Error( 'Unable to download file from url.' ) );
        }

        // Stream the contents to a local file
        const write = fs.createWriteStream( generateLocalFilename( audioId ) );

        write.on( 'error', done );
        write.on( 'finish', done );

        read.pipe( write );
        read.resume();

      } );

  } );
}

function generateLocalFilename( audioId ) {
  return path.resolve( STORAGE_DIR, audioId ) + '.json';
}
