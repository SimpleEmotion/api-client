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

const API = require( '..' )( null, null, { scope: 'callcenter operations storage', host: 'https://api.dev.simpleemotion.com' } );
API.credentials = Config.credentials;

if ( require.main === module ) {
  main();
}

function main() {

  if ( process.argv.length !== 3 ) {
    console.error( `[ERROR] Expected 1 argument but found ${process.argv.length - 2}.` );
  }

  const filename = process.argv[ 2 ];

  console.log( '[!] Removing audio file from root folder.' );

  // Remove existing audio file
  API.storage.audio.remove(
    {
      audio: {
        owner: Config.owner,
        service: Config.service,
        name: '/' + path.basename( filename )
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
            basename: path.basename( filename ),
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

          console.log( `[!] Reading audio file from ${filename.bgBlack}.` );

          fs.readFile( filename, ( err, data ) => {

            if ( err ) {
              return console.error( err );
            }

            console.log( '[!] Getting audio file upload url.' );

            API.storage.audio.getUploadUrl(
              {
                audio: audio
              },
              ( err, result ) => {

                if ( err ) {
                  return console.error( err );
                }

                console.log( '[!] Uploading audio file.' );

                request.put( result.url, ( err, res, body ) => {

                  if ( err ) {
                    return console.error( err );
                  }

                  if ( res.statusCode >= 400 ) {
                    return console.error( body );
                  }

                  API.callcenter.metrics.contact.compute(
                    {
                      audio: audio
                    },
                    function ( err, result ) {

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

                        console.log( '[I] storage.analysis._id: ', `${result.operation.result.analysis_id}`.bgBlack );

                        console.log( '[!] Retrieving analysis data.' );

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

                            const output = filename + '.contact.metrics.json';

                            console.log( `[!] Writing analysis data to ${output.bgBlack}.` );

                            fs.writeFile( output, JSON.stringify( result.analysis.data ), err => {

                              if ( err ) {
                                console.error( err );
                              }

                            } );

                          }
                        );

                      } );
                    }
                  );

                } ).end( data );

              }
            );

          } );

        }
      );

    }
  );

}
