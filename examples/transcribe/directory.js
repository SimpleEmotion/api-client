'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const request = require( 'request' );

// INFO: Obtain credentials from https://console.simpleemotion.com
// INFO: Obtain user id from https://console.simpleemotion.com/api/user

const Config = {
  credentials: {
    client_id: process.env.SIMPLE_EMOTION_API_CLIENT_ID,
    client_secret: process.env.SIMPLE_EMOTION_API_CLIENT_SECRET
  },
  owner: {
    _id: process.env.SIMPLE_EMOTION_API_USER_ID,
    type: 'user'
  },
  service: 'examples/transcribe/directory'
};

const API = require( '../..' )( null, null, { scope: 'operations speech storage' } );
API.credentials = Config.credentials;

if ( require.main === module ) {
  main();
}

function main() {

  if ( process.argv.length !== 3 ) {
    console.error( `[ERROR] Expected 1 argument but found ${process.argv.length - 2}.` );
  }

  const dirpath = path.resolve( process.argv[ 2 ] );

  console.log( '[!] Building list of local files.' );

  return getWavFilesInDir( dirpath, ( err, files ) => {

    if ( err ) {
      return console.error( err );
    }

    console.log( `[!] Creating audio objects for ${files.length} files.` );

    createAudio( files, ( err, audio ) => {

      if ( err ) {
        return console.error( err );
      }

      // console.log( `[!] Uploading ${files.length} audio files.` );
      //
      // uploadAudio( files, audio, ( err, uploads ) => {
      //
      //   if ( err ) {
      //     return console.error( err );
      //   }
      //
      //   console.log( `[!] ${files.length} audio files were uploaded.` );

      // console.log( `[!] Transcribing ${audio.length} audio files.` );
      //
      // transcribeAudio( audio, ( err, operations ) => {
      //
      //   if ( err ) {
      //     return console.error( err );
      //   }
      //
      //   operations.forEach( ( o, i ) => console.log( `[${i}] ${o._id}` ) );
      //
      // } );

      // } );

      getTranscribeOperations( audio, ( err, operations ) => {

        if ( err ) {
          return console.error( err );
        }

        operations.forEach( ( o, i ) => console.log( `[${i}] ${o._id}` ) );

      } );

    } );

  } );

  API.operations.onComplete( result, ( err, result ) => {

    if ( err ) {
      return console.error( result );
    }

    if ( result.operation.error ) {
      return console.error( result.operation.error );
    }

    console.log( '[I] storage.analysis._id: ', `${result.operation.result.analysis_id}`.bgBlack );

    console.log( '[!] Retrieving transcription.' );

    API.storage.analysis.get(
      {
        analysis: {
          _id: result.operation.result.analysis_id,
          audio: audio
        }
      },
      ( err, result ) => {

        if ( err ) {
          return console.error( err );
        }

        const output = dirpath + '.transcript.turns.json';

        console.log( `[!] Writing transcription to ${output.bgBlack}.` );

        fs.writeFile( output, JSON.stringify( result.analysis.data ), err => {

          if ( err ) {
            console.error( err );
          }

        } );

      }
    );

  } );

}

function getWavFilesInDir( dirpath, done ) {
  fs.readdir( dirpath, ( err, files ) => {

    if ( err ) {
      return done( err, null );
    }

    files = files.filter( f => path.extname( f ) === '.wav' )
                 .map( f => path.resolve( dirpath, f ) );

    done( null, files );

  } );
}

function createAudio( files, done ) {

  const batch = files.map( f => (
    {
      destination: {
        folder: {
          owner: Config.owner,
          service: Config.service,
          name: ''
        }
      },
      audio: {
        basename: path.basename( f ),
        metadata: {
          speakers: [
            {
              _id: 'agent',
              role: 'agent'
            },
            {
              _id: 'customer',
              role: 'customer'
            }
          ]
        }
      },
      ensure: true
    }
  ) );

  API.storage.audio.add.batch( batch, ( err, results ) => {

    if ( err ) {
      return done( err, null );
    }

    const audio = results.map( r => r.audio );

    done( null, audio );

  } );

}

function uploadAudio( files, audio, done ) {

  if ( files.length !== audio.length ) {
    return done( new Error( 'Files and audio length mismatch.' ), null );
  }

  const uploads = [];

  (function next( i, n ) {

    if ( i >= n ) {
      return done( null, uploads );
    }

    console.log( `[${i}] Getting audio file upload url.` );

    API.storage.audio.getUploadUrl(
      {
        audio: audio[ i ]
      },
      ( err, result ) => {

        if ( err ) {
          return err.code === 409 ? next( i + 1, n ) : done( err, uploads );
        }

        console.log( `[${i}] Reading local audio file.` );

        fs.readFile( files[ i ], ( err, data ) => {

          if ( err ) {
            return done( err, uploads );
          }

          console.log( `[${i}] Uploading audio file.` );

          request.put( result.url, ( err, res, body ) => {

            if ( err ) {
              return done( err, uploads );
            }

            if ( res.statusCode >= 400 ) {
              return done( body, uploads );
            }

            uploads.push( audio[ i ] );

            next( i + 1, n );

          } ).end( data );

        } );

      }
    );

  })( 0, files.length );

}

function transcribeAudio( audio, done ) {

  const batch = audio.map( a => (
    {
      audio: a,
      diarized: true
    }
  ) );

  API.speech.transcribe.batch( batch, ( err, results ) => {

    if ( err ) {
      return done( err, null );
    }

    const operations = results.map( r => r.operation );

    done( null, operations );

  } );

}

function getTranscripts( audio, done ) {

  const batch = audio.map( a => (
    {
      audio: a,
      type: 'transcribe-diarized-speech',
      limit: 1
    }
  ) );

  API.storage.analysis.list.batch( batch, ( err, results ) => {

    if ( err ) {
      return done( err, null );
    }

    const operations = results.map( r => r.operation );

    done( null, operations );

  } );

}
