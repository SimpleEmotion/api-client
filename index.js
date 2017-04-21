'use strict';

var request = require( 'request' );
var objectpath = require( 'object-path' );

module.exports = APIClient;

function APIClient( client_id, client_secret, opts ) {

  if ( !this || this.constructor !== APIClient ) {
    return new APIClient( client_id, client_secret, opts );
  }

  var api = this;

  api.credentials = {
    client_id: client_id,
    client_secret: client_secret
  };

  opts = opts || {};
  api.protocol = opts.protocol || 'https';
  api.host = opts.host || 'https://api.simpleemotion.com';
  api.endpoint = opts.endpoint || '';

  var scope = opts.scope || '';
  var tokens = {};

  api.request = function ( opts, done ) {
    request( opts, function ( err, res, body ) {

      if ( err ) {
        return done( err, null );
      }

      if ( !res || !body ) {
        return done( new Error( 'No response.' ), null );
      }

      if ( typeof body !== 'object' && !Array.isArray( body ) ) {
        return done( body, null );
      }

      if ( body.err ) {
        return done( body.err, null );
      }

      done( null, body );

    } );
  };

  api.request.authorized = function ( method, path, body, done ) {

    var opts = {
      method: method,
      uri: api.host + path,
      headers: {
        'Authorization': 'Bearer ' + tokens.access_token,
        'Content-Type': 'application/json'
      }
    };

    if ( body ) {

      // GET requests cannot have body
      if ( method.toUpperCase() !== 'GET' ) {
        opts.json = body;
      }

    }

    if ( !tokens.access_token ) {
      return reauthorize();
    }

    // Authorized attempt
    api.request( opts, function ( err, result ) {

      if ( !err ) {
        return done( null, result );
      }

      if ( err.code !== 401 ) {
        return done( err, null );
      }

      reauthorize();

    } );

    function reauthorize() {
      api.oauth2.token.grant( scope, function ( err, result ) {

        if ( err ) {
          return done( err, null );
        }

        tokens = result;
        opts.headers.Authorization = 'Bearer ' + tokens.access_token;

        // Reauthorized attempt
        api.request( opts, done );

      } );
    }

  };

  api.getAuthTokens = function () {
    return tokens;
  };

  api.setAuthTokens = function ( auth_tokens ) {
    tokens = auth_tokens || {};
  };

  var methods = [
    'callcenter.metrics.agent.compute',
    'callcenter.metrics.contact.compute',
    'communication.email.next',
    'communication.email.queue',
    'communication.email.remove',
    'communication.phone.get',
    'communication.phone.link',
    'communication.phone.verify',
    'communication.phone.remove',
    'communication.phone.addTwilio',
    'communication.sms.next',
    'communication.sms.queue',
    'communication.sms.remove',
    'communication.sms.send.message',
    'communication.sms.send.verification',
    'directory.organization.add',
    'directory.organization.exists',
    'directory.organization.get',
    'directory.organization.list',
    'directory.organization.remove',
    'directory.organization.rename',
    'directory.organization.service.add',
    'directory.organization.service.remove',
    'directory.organization.user.add',
    'directory.organization.user.list',
    'directory.organization.user.remove',
    'directory.organization.user.invitation.add',
    'directory.organization.user.invitation.remove',
    'emotion.tone.extract',
    'integration.talkdesk.get',
    'integration.talkdesk.list',
    'integration.talkdesk.user.get',
    'integration.talkdesk.user.list',
    'language.problem.summarize',
    'language.sentiment.extract',
    'language.tags.extract',
    'language.tags.train',
    'oauth2.credentials.generate',
    'oauth2.credentials.get',
    'oauth2.credentials.list',
    'oauth2.credentials.redirect_uri.add',
    'oauth2.credentials.redirect_uri.remove',
    'oauth2.credentials.remove',
    'oauth2.user.add',
    'oauth2.user.get',
    'oauth2.user.list',
    'oauth2.user.register',
    'oauth2.user.remove',
    'oauth2.user.email.link',
    'oauth2.user.email.verify',
    'oauth2.user.password.link',
    'oauth2.user.password.reset',
    'oauth2.user.twoFactor.disable',
    'oauth2.user.twoFactor.enroll',
    'oauth2.user.twoFactor.verify',
    'operations.add',
    'operations.get',
    'operations.list',
    'operations.next',
    'operations.remove',
    'operations.update',
    'speaker.voice.diarize',
    'speaker.voice.train',
    'speaker.words.diarize',
    'speech.detect',
    'speech.transcribe',
    'storage.analysis.add',
    'storage.analysis.exists',
    'storage.analysis.get',
    'storage.analysis.list',
    'storage.analysis.remove',
    'storage.analysis.rename',
    'storage.audio.add',
    'storage.audio.exists',
    'storage.audio.get',
    'storage.audio.getDownloadUrl',
    'storage.audio.getUploadUrl',
    'storage.audio.list',
    'storage.audio.move',
    'storage.audio.process',
    'storage.audio.remove',
    'storage.audio.uploadFromUrl',
    'storage.features.add',
    'storage.features.exists',
    'storage.features.get',
    'storage.features.getDownloadUrl',
    'storage.features.getUploadUrl',
    'storage.features.list',
    'storage.features.remove',
    'storage.features.rename',
    'storage.folder.add',
    'storage.folder.exists',
    'storage.folder.get',
    'storage.folder.list',
    'storage.model.add',
    'storage.model.exists',
    'storage.model.get',
    'storage.model.getDownloadUrl',
    'storage.model.getUploadUrl',
    'storage.model.list',
    'storage.model.remove',
    'storage.model.rename',
    'webhook.add',
    'webhook.delivery.add',
    'webhook.delivery.get',
    'webhook.delivery.list',
    'webhook.delivery.remove',
    'webhook.delivery.retry',
    'webhook.delivery.retryAll',
    'webhook.delivery.update',
    'webhook.disable',
    'webhook.enable',
    'webhook.event.add',
    'webhook.event.get',
    'webhook.event.next',
    'webhook.event.remove',
    'webhook.get',
    'webhook.list',
    'webhook.remove'
  ];

  generate( api, methods );

  api.oauth2.token = function Token( token ) {

    if ( !this || this.constructor !== Token ) {
      return new Token( token );
    }

    this.revoke = function ( done ) {

      var opts = {
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

  api.oauth2.token.grant = function ( data, scope, done ) {

    var grant_type = 'password';

    if ( !done ) {
      grant_type = tokens.refresh_token ? 'refresh_token' : 'client_credentials';
      done = scope;
      scope = data;
      data = {};
    }

    var opts = {
      method: 'POST',
      uri: api.host + api.endpoint + '/oauth2/token',
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
        scope: ( Array.isArray( scope ) ? scope.join( ' ' ) : scope ) || ''
      }
    };

    api.request( opts, done );

  };

  api.operations.onComplete = function ( data, done ) {
    api.operations.get( data, function ( err, result ) {

      if ( err ) {
        return done( err, null );
      }

      if ( !result.operation.states.completed ) {
        return setTimeout( api.operations.onComplete.bind( null, data, done ), 1000 );
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
  } );
}
