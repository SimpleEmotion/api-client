'use strict';

require( 'colors' );

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
  service: 'examples'
};

const API = require( '..' )(
  Config.credentials.client_id,
  Config.credentials.client_secret,
  {
    scope: 'operations storage',
    host: 'https://api.simpleemotion.com'
  }
);

if ( require.main === module ) {
  main();
}

function main() {

  if ( process.argv.length !== 3 ) {
    console.error( `[ERROR] Expected 1 argument but found ${process.argv.length - 2}.` );
  }

  const url = process.argv[ 2 ];

  for ( var i = 0; i < 1; ++i ) {
    run( i, url );
  }

  function run( i ) {

    console.log( '[!] Removing audio file from root folder.' );

    // Remove existing audio file
    API.storage.audio.remove(
      {
        audio: {
          owner: Config.owner,
          service: Config.service,
          name: '/' + i + '-' + path.basename( url )
        }
      },
      err => {

        if ( err && err.code !== 404 ) {
          return console.error( err );
        }

        console.log( '[!] Adding audio file to root folder.' );

        // Add audio file to root folder
        API.storage.audio.add(
          {
            destination: {
              folder: {
                owner: Config.owner,
                service: Config.service,
                name: ''
              }
            },
            audio: {
              basename: i + '-' + path.basename( url ),
              metadata: {
                speakers: [
                  { _id: 'Jared', role: 'agent' },
                  { _id: 'Steve Brown', role: 'customer' }
                ]
              }
            },
            ensure: true
          },
          ( err, result ) => {

            if ( err ) {
              return console.error( err );
            }

            const audio = result.audio;

            console.log( '[I] storage.audio._id:', `${audio._id}`.bgBlack );

            console.log( `[!] Transloading audio from url ${url.bgBlack}.` );

            API.storage.audio.uploadFromUrl(
              {
                audio: audio,
                url: url
              },
              ( err, result ) => {

                if ( err ) {
                  return console.error( err );
                }

                console.log( '[I] operation._id: ', `${result.operation._id}`.bgBlack );

                console.log( '[!] Waiting for operation to complete.' );

                API.operations.onComplete( result, ( err, result ) => {

                  if ( err ) {
                    return console.error( result );
                  }

                  if ( result.operation.error ) {
                    return console.error( result.operation.error );
                  }

                  console.log( '[DONE]' );

                } );

              }
            );

          }
        );

      }
    );

  }

}
