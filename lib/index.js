'use strict';

const request = require( 'request' );
const objectpath = require( 'object-path' );

const MAX_RETRY_COUNT = 5;

module.exports = APIClient;

const methods = [

  'callcenter.v2.transcript.classify',

  // 'communication.v0.email.queue',
  // 'communication.phone.get',
  // 'communication.phone.link',
  // 'communication.phone.verify',
  // 'communication.phone.remove',
  // 'communication.phone.addTwilio',
  // 'communication.sms.queue',
  // 'communication.sms.send.verification',

  'directory.v1.organization.add',
  'directory.v1.organization.exists',
  'directory.v1.organization.get',
  'directory.v1.organization.list',
  'directory.v1.organization.remove',
  'directory.v1.organization.rename',
  'directory.v1.organization.restore',
  'directory.v1.organization.service.add',
  'directory.v1.organization.service.remove',
  'directory.v1.organization.user.add',
  'directory.v1.organization.user.admin.grant',
  'directory.v1.organization.user.admin.revoke',
  'directory.v1.organization.user.list',
  'directory.v1.organization.user.remove',
  'directory.v1.organization.user.invitation.add',
  'directory.v1.organization.user.invitation.remove',

  'emotion.v2.tone.extract',

  'integration.v1.talkdesk.job',
  'integration.v1.talkdesk.installation.get',
  'integration.v1.talkdesk.installation.list',
  'integration.v1.talkdesk.installation.user.get',
  'integration.v1.talkdesk.installation.user.list',

  'language.v2.sentiment.extract',

  'oauth2.v1.credentials.generate',
  'oauth2.v1.credentials.get',
  'oauth2.v1.credentials.list',
  'oauth2.v1.credentials.redirect_uri.add',
  'oauth2.v1.credentials.redirect_uri.remove',
  'oauth2.v1.credentials.remove',

  'oauth2.v1.user.add',
  'oauth2.v1.user.get',
  'oauth2.v1.user.list',
  'oauth2.v1.user.register',
  'oauth2.v1.user.remove',
  'oauth2.v1.user.email.link',
  'oauth2.v1.user.email.verify',
  'oauth2.v1.user.password.link',
  'oauth2.v1.user.password.reset',
  'oauth2.v1.user.twoFactor.disable',
  'oauth2.v1.user.twoFactor.enroll',
  'oauth2.v1.user.twoFactor.verify',
  'oauth2.v1.verification.code.send',

  'operation.v2.add',
  'operation.v2.get',
  'operation.v2.list',
  'operation.v2.remove',

  'speech.v2.transcribe',
  'speech.v2.transcribeKaldi',

  'storage.v2.audio.add',
  'storage.v2.audio.exists',
  'storage.v2.audio.get',
  'storage.v2.audio.getLinks',
  'storage.v2.audio.getUploadUrl',
  'storage.v2.audio.list',
  'storage.v2.audio.process',
  'storage.v2.audio.recording.add',
  'storage.v2.audio.recording.exists',
  'storage.v2.audio.recording.get',
  'storage.v2.audio.recording.getLink',
  'storage.v2.audio.recording.list',
  'storage.v2.audio.recording.remove',
  'storage.v2.audio.redact',
  'storage.v2.audio.remove',
  'storage.v2.audio.rename',
  'storage.v2.audio.uploadFromUrl',

  'storage.v2.document.exists',
  'storage.v2.document.get',
  'storage.v2.document.getLink',
  'storage.v2.document.list',
  'storage.v2.document.remove',

  'webhook.v1.add',
  'webhook.v1.delivery.add',
  'webhook.v1.delivery.get',
  'webhook.v1.delivery.list',
  'webhook.v1.delivery.remove',
  'webhook.v1.delivery.retry',
  'webhook.v1.delivery.retryAll',
  'webhook.v1.delivery.update',
  'webhook.v1.disable',
  'webhook.v1.enable',
  'webhook.v1.event.add',
  'webhook.v1.event.get',
  'webhook.v1.event.next',
  'webhook.v1.event.remove',
  'webhook.v1.get',
  'webhook.v1.list',
  'webhook.v1.remove'

];

function APIClient( client_id, client_secret, opts ) {

  if ( !this || this.constructor !== APIClient ) {
    return new APIClient( client_id, client_secret, opts );
  }

  const api = this;

  api.credentials = {
    client_id: client_id,
    client_secret: client_secret
  };

  opts = opts || {};

  opts.logger = opts.logger || console;

  api.protocol = opts.protocol || 'https';
  api.host = opts.host || 'https://api.simpleemotion.com';
  api.endpoint = opts.endpoint || '';

  const scope = api.scope = opts.scope || '';
  let tokens = {};

  api.request = function ( req_opts, done, retry_count ) {

    if ( opts.debug ) {
      opts.logger.log( req_opts );
    }

    request( req_opts, function ( err, res, body ) {

      if ( err ) {
        return done( { code: 500, err: err }, null );
      }

      if ( !res || ( !body && res.statusCode < 400 ) ) {
        return done( { code: 500, err: new Error( 'No response.' ) }, null );
      }

      if ( res.statusCode === 502 && ( retry_count || 0 ) < MAX_RETRY_COUNT ) {
        return api.request( req_opts, done, retry_count + 1 );
      }

      if ( res.statusCode >= 400 || ( typeof body !== 'object' && !Array.isArray( body ) ) ) {
        return done( { code: res.statusCode || 500, err: body.err || new Error( body ) } );
      }

      if ( body.err ) {
        return done( body.err, null );
      }

      done( null, body );

    } );

  };

  api.request.authorized = function ( method, path, body, done ) {

    if ( !tokens.access_token ) {
      return reauthorize();
    }

    const opts = {
      method: method,
      uri: api.host + path,
      headers: {
        'Authorization': 'Bearer ' + tokens.access_token,
        'Content-Type': 'application/json'
      }
    };

    // GET requests cannot have body
    if ( body && method.toUpperCase() !== 'GET' ) {
      opts.json = body;
    }

    // Authorized attempt
    api.request( opts, function ( err, result ) {

      if ( !err ) {
        return done( null, result );
      }

      // Throw error for non-authentication errors
      if ( err.code !== 401 ) {
        return done( err, null );
      }

      let jwt_expired = false;

      JSON.stringify( err, ( k, v ) => {
        if ( k === 'reason' && v === 'jwt expired' ) {
          jwt_expired = true;
        }

        return v;
      } );

      // Throw error for authentication errors not relating to expired jwt
      if ( !jwt_expired ) {
        return done( err, null );
      }

      reauthorize();

    } );

    function reauthorize() {
      api.oauth2.v1.token.grant( scope, function ( err, result ) {

        if ( err ) {
          return done( err, null );
        }

        tokens = result;

        api.request.authorized( method, path, body, done );

      } );
    }

  };

  api.getAuthTokens = function () {
    return tokens;
  };

  api.setAuthTokens = function ( auth_tokens ) {
    tokens = auth_tokens || {};
  };

  generate( api, methods );

  api.oauth2.v1.token = function Token( token ) {

    if ( !this || this.constructor !== Token ) {
      return new Token( token );
    }

    this.revoke = function ( done ) {

      const opts = {
        method: 'POST',
        uri: api.host + api.endpoint + '/oauth2/revoke',
        json: {
          client_id: api.credentials.client_id,
          client_secret: api.credentials.client_secret,
          token: token
        }
      };

      api.request( opts, done );

    };

  };

  api.oauth2.v1.token.grant = function ( data, scope, done ) {

    let grant_type = 'password';

    if ( !done ) {
      grant_type = tokens.refresh_token ? 'refresh_token' : 'client_credentials';
      done = scope;
      scope = data;
      data = {};
    }

    const opts = {
      method: 'POST',
      uri: api.host + api.endpoint + '/oauth2/v1/token',
      json: {
        grant_type: data.grant_type || grant_type,
        client_id: api.credentials.client_id,
        client_secret: api.credentials.client_secret,
        email: data.email,
        password: data.password,
        otp: data.otp,
        code: data.code,
        access_token: data.access_token,
        refresh_token: tokens.refresh_token,
        redirect_uri: data.redirect_uri,
        user_id: data.user_id,
        scope: ( Array.isArray( scope ) ? scope.join( ' ' ) : scope ) || ''
      }
    };

    api.request( opts, done );

  };

  api.operation.onComplete = function ( data, done ) {
    api.operation.get( data, function ( err, result ) {

      if ( err ) {
        return done( err, null );
      }

      if ( !result.operation.states.completed ) {
        return setTimeout( api.operation.onComplete.bind( null, data, done ), 1000 );
      }

      done( null, result );

    } );
  };

}

function generate( api, methods ) {
  methods.forEach( function ( method ) {

    objectpath.set( api, method, function ( data, done ) {
      api.request.authorized( 'POST', api.endpoint + '/' + method.replace( /\./g, '/' ), data, done );
    } );

    objectpath.set( api, method + '.batch', function ( data, done ) {
      batch( objectpath.get( api, method ), data, done );
    } );

  } );
}

function batch( method, queries, done ) {

  const MAX_BATCH_SIZE = 100;

  let results = [];

  ( function next( i, n ) {

    if ( i >= n ) {
      return done( null, results );
    }

    method( queries.slice( i, i + MAX_BATCH_SIZE ), function ( err, result ) {

      if ( err ) {
        return done( err, results );
      }

      results = results.concat( result );

      next( i + result.length, n );

    } );

  } )( 0, queries.length );

}
