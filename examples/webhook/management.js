'use strict';

require( 'colors' );

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
  service: 'webhooks'
};

const URL = 'https://se-ws-akash.dev.simpleemotion.com';
const SECRET = 'IM SUPER SECRET';
const EVENT = {
  type: 'storage.audio.added'
};

const API = require( '..' )( null, null, { scope: 'webhook', host: 'https://api.simpleemotion.com' } );
API.credentials = Config.credentials;

if ( require.main === module ) {
  main();
}

function main() {

  console.log( '[!] Adding webhook.' );

  API.webhook.add(
    {
      webhook: {
        owner: Config.owner,
        url: URL,
        secret: SECRET,
        event: EVENT
      }
    },
    function ( err, result ) {

      if ( err ) {
        return console.error( err );
      }

      const webhook = result.webhook;

      console.log( JSON.stringify( result, null, 2 ).bgBlack );

      console.log();
      console.log( `[!] Listing webhooks for owner ${Config.owner._id}.` );
      console.log( '[!] NOTE: This list includes webhooks added to this owner by all sources.' );

      API.webhook.list(
        {
          webhook: {
            owner: Config.owner
          }
        },
        function ( err, result ) {

          if ( err ) {
            return console.error( err );
          }

          if ( !result.total ) {
            console.log( 'No webhooks found.'.bgBlack );
          }

          result.webhooks.forEach( function ( w, i ) {
            console.log( `[${i}]\t_id: ${w._id}\tevent.type: ${w.event.type}`.bgBlack );
          } );

          console.log();
          console.log( `[!] Removing the webhook we added with _id: ${webhook._id}.` );

          API.webhook.remove(
            {
              webhook: webhook
            },
            function ( err, result ) {

              if ( err ) {
                return console.error( err );
              }

              console.log( JSON.stringify( result, null, 2 ).bgBlack );

              console.log();
              console.log( '[!] Listing webhooks for owner ' + Config.owner._id + '.' );
              console.log( '[!] NOTE: This list includes webhooks added to this owner by all sources.' );

              API.webhook.list(
                {
                  webhook: {
                    owner: Config.owner
                  }
                },
                function ( err, result ) {

                  if ( err ) {
                    return console.error( err );
                  }

                  if ( !result.total ) {
                    console.log( 'No webhooks found.'.bgBlack );
                  }

                  result.webhooks.forEach( function ( w, i ) {
                    console.log( `[${i}]\t_id: ${w._id}\tevent.type: ${w.event.type}`.bgBlack );
                  } );

                  console.log();
                  console.log( '[ALL DONE!!!]' );
                  console.log();

                }
              );

            }
          );

        }
      );

    }
  );

}
