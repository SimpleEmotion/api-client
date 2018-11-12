'use strict';

const SEAPIClient = require( '../../lib' );
const CallAnalyticsAppAPIClient = require( '../../lib/call-analytics-app' );

const SEAPI = new SEAPIClient(
  process.env.SIMPLE_EMOTION_API_CLIENT_ID,
  process.env.SIMPLE_EMOTION_API_CLIENT_SECRET,
  {}
);

const CAAAPI = new CallAnalyticsAppAPIClient( SEAPI, {} );

if ( require.main === module ) {
  main().catch( console.error );
}

async function main() {

  const { data: { user } } = await CAAAPI.user.get();

  console.log( user._id, user.email );

  await CAAAPI.user.session.remove();

}
