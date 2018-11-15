'use strict';

const express = require( 'express' );
const bodyParser = require( 'body-parser' );
const crypto = require( 'crypto' );
const bufferEq = require( 'buffer-equal-constant-time' );

const PORT = process.env.PORT || 80;
const CALLBACK_PATH = '/api/integration/simple-emotion/event';
const CALLBACK_SECRET = 'SUPER SECRET';

let app = express();

app.use( bodyParser.json() );

app.post( CALLBACK_PATH, ( req, res, next ) => {

  // Extract signature and payload from request for verification
  const signature = req.get( 'X-SE-Signature' ) || '';
  const payload = JSON.stringify( req.body );

  // Compute signature from payload
  const computed_signature = sign( CALLBACK_SECRET, payload );

  // Securely verify signatures match
  if ( !bufferEq( Buffer.from( signature ), Buffer.from( computed_signature ) ) ) {
    return next( new Error( 'Signature mismatch. Received invalid webhook.' ) );
  }

  // Response must echo webhook challenge
  res.set( 'X-SE-Challenge', req.get( 'X-SE-Challenge' ) );

  // Send response with a 2xx status code before processing the event
  res.status( 200 ).end();

  // Extract event
  const event = req.body.event.type;

  // TODO: HANDLE EVENT
  console.log( req.body );

} );

app.listen( PORT, () => console.log( 'HTTP server listening on port %d.', PORT ) );

function sign( secret, data ) {
  return crypto.createHmac( 'sha1', secret ).update( data ).digest( 'hex' );
}
