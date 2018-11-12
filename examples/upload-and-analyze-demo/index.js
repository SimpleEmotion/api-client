'use strict';

const { promisify: p } = require( 'util' );
const config = require( './config' );
const SEAPIClient = require( '@simple-emotion/api-client' );
const uuidV4 = require( 'uuid/v4' );

//TODO: FILL IN THE REQUIRED INFO IN CONFIG (client_id, client_secret, and owner._id)
const owner = config.owner;

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

const audioURL = "YOUR-AUDIO-URL";
const webhookURL = 'YOUR-SERVERS-WEBHOOK-ENDPOINT';

module.exports = {
  handler,
  addWebhook,
  uploadAudio,
  analyzeAudio
};

/**************************
 * One time webhook set up
 **************************/
// Sets up a webhook that listens for the operation.complete event
// Returns the webhook object
async function addWebhook( uri ) {

  // Set up webhook for operation.complete event
  const result = await p( SEAPI.webhook.v1.add )(
    {
      webhook: {
        owner: owner,
        event: { type: 'operation.complete' },
        url: uri, //TODO: fill in with your server's webhook url
        secret: 'FAKE_SECRET' //TODO: fill in a secret. used to validate the webhook request origin and data
      }
    }
  );

  console.log( 'Webhook add result:' );
  console.log( JSON.stringify( result, null, 2 ) );

  return result;

}


/**************************
 * Functions to run for every audio you want analyzed
 **************************/
// Creates an audio file and uploads audio data to the SE database
// webhooks registered for the 'operation.completed' event will be hit when upload operation completes
// url is the url the your audio file is stored at
// tags is an array of strings to attach to the upload operation as tags
// returns audio id and upload operation id
async function uploadAudio( url, tags ) {

  // Add audio file
  const { audio } = await p( SEAPI.storage.v2.audio.add )( {
                                                             audio: {
                                                               name: uuidV4(),
                                                               owner: owner,
                                                               metadata: {
                                                                 speakers: [
                                                                   { _id: 'speakerCh0', role: 'customer' },
                                                                   { _id: 'speakerCh1', role: 'agent' }
                                                                 ]
                                                               }
                                                             }
                                                           } );

  console.log( 'Audio add result:' );
  console.log( JSON.stringify( audio, null, 2 ) );

  // Upload raw audio data
  const { operation } = await p( SEAPI.storage.v2.audio.uploadFromUrl )( {
                                                                           audio: {
                                                                             _id: audio._id,
                                                                             owner: owner
                                                                           },
                                                                           url: url,
                                                                           operation: {
                                                                             tags: [ `audio_id=${audio._id}`, ...tags ]
                                                                           }
                                                                         } );

  console.log( 'Audio uploadFromUrl result' );
  console.log( JSON.stringify( operation, null, 2 ) );

  return { audio, operation };

}

// Begins a classify-transcript analysis operation for the specified audioId.
// webhooks registered for the 'operation.completed' event will be hit when analysis operation completes
// audioId is the audio._id for the audio file that you want to analyze
// Returns the operation object
async function analyzeAudio( audioId ) {
  // Start up an operation
  const operation = await p( SEAPI.callcenter.v2.transcript.classify )(
    {
      audio: {
        _id: audioId,
        owner: owner
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

  console.log( 'Started classify transcript operation' );
  console.log( JSON.stringify( operation, null, 2 ) );
  return operation;
}

// Basic webhook handler. NOTE: ignores request signature validation. See docs for proper webhook handling https://docs.simpleemotion.com/docs/handling-webhooks
function handler( req, res ) {
  const data = req.body.data;

  // Respond to the webhook
  res.set( 'X-SE-Challenge', req.get( 'X-SE-Challenge' ) );
  res.status( 200 ).end();

  // Wrong event. Ignore.
  if ( req.body.event.type !== 'operation.complete' ) {
    return console.log( 'Received event we dont care about:', req.body.event.type );
  }

  SEAPI.operation.v2.get( data, ( err, result ) => {
    if ( err ) {
      return console.error( err );
    }

    if ( result.operation.error ) {
      console.log( 'Operation failed!' );
      return console.error( result.operation.error );
    }

    if ( result.operation.type === 'transload-audio' ) {
      analyzeAudio( result.operation.parameters.audio_id ).then( console.log ).catch( console.log );
    }
    else if ( result.operation.type === 'classify-transcript' ) {
      console.log( 'Analysis complete!' );
      console.log( result.operation );

      SEAPI.storage.v2.document.getLink( { document: result.operation.result.document.classifications }, ( err, result ) => {
        if ( err ) {
          return console.error( err );
        }

        console.log( 'analysis link:', result.document.link );

        // JSON data can be downloaded from result.document.link. Links expire after 30 seconds.
        // Analysis result from each step of the pipe line can be obtained by inspecting the operation.progress[] field
        // Check operation.progress[].result.document for the document info and use the SEAPI.storage.v2.document.getLink
        // API function

      } );
    }

  } );
}

// Call this function to add a webhook - Only needs to be done once per URI
// addWebhook(webhookURL).then( console.log ).catch( console.log );

// Call this function to upload an audio file
// uploadAudio( audioURL, [] ).then( console.log ).catch( console.log );
