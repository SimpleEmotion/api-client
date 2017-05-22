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
    'callcenter.v0.metrics.agent.compute',
    'callcenter.v1.metrics.agent.compute',

    'callcenter.metrics.contact.compute',
    'callcenter.v0.metrics.contact.compute',
    'callcenter.v1.metrics.contact.compute',

    // 'communication.email.next',
    // 'communication.email.queue',
    // 'communication.email.remove',
    // 'communication.phone.get',
    // 'communication.phone.link',
    // 'communication.phone.verify',
    // 'communication.phone.remove',
    // 'communication.phone.addTwilio',
    // 'communication.sms.next',
    // 'communication.sms.queue',
    // 'communication.sms.remove',
    // 'communication.sms.send.message',
    // 'communication.sms.send.verification',

    'directory.organization.add',
    'directory.v0.organization.add',
    'directory.v1.organization.add',

    'directory.organization.exists',
    'directory.v0.organization.exists',
    'directory.v1.organization.exists',

    'directory.organization.get',
    'directory.v0.organization.get',
    'directory.v1.organization.get',

    'directory.organization.list',
    'directory.v0.organization.list',
    'directory.v1.organization.list',

    'directory.organization.remove',
    'directory.v0.organization.remove',
    'directory.v1.organization.remove',

    'directory.organization.rename',
    'directory.v0.organization.rename',
    'directory.v1.organization.rename',

    'directory.organization.service.add',
    'directory.v0.organization.service.add',
    'directory.v1.organization.service.add',

    'directory.organization.service.remove',
    'directory.v0.organization.service.remove',
    'directory.v1.organization.service.remove',

    'directory.organization.user.add',
    'directory.v0.organization.user.add',
    'directory.v1.organization.user.add',

    'directory.organization.user.list',
    'directory.v0.organization.user.list',
    'directory.v1.organization.user.list',

    'directory.organization.user.remove',
    'directory.v0.organization.user.remove',
    'directory.v1.organization.user.remove',

    'directory.organization.user.invitation.add',
    'directory.v0.organization.user.invitation.add',
    'directory.v1.organization.user.invitation.add',

    'directory.organization.user.invitation.remove',
    'directory.v0.organization.user.invitation.remove',
    'directory.v1.organization.user.invitation.remove',

    'emotion.tone.extract',
    'emotion.v0.tone.extract',
    'emotion.v1.tone.extract',

    'integration.talkdesk.job',
    'integration.v0.talkdesk.job',
    'integration.v1.talkdesk.job',

    'integration.talkdesk.installation.get',
    'integration.v0.talkdesk.installation.get',
    'integration.v1.talkdesk.installation.get',

    'integration.talkdesk.installation.list',
    'integration.v0.talkdesk.installation.list',
    'integration.v1.talkdesk.installation.list',

    'integration.talkdesk.installation.user.get',
    'integration.v0.talkdesk.installation.user.get',
    'integration.v1.talkdesk.installation.user.get',

    'integration.talkdesk.installation.user.list',
    'integration.v0.talkdesk.installation.user.list',
    'integration.v1.talkdesk.installation.user.list',

    'language.problem.summarize',
    'language.v0.problem.summarize',
    'language.v1.problem.summarize',

    'language.sentiment.extract',
    'language.v0.sentiment.extract',
    'language.v1.sentiment.extract',

    'language.tags.extract',
    'language.v0.tags.extract',
    'language.v1.tags.extract',

    'language.tags.train',
    'language.v0.tags.train',
    'language.v1.tags.train',

    'oauth2.credentials.generate',
    'oauth2.v0.credentials.generate',
    'oauth2.v1.credentials.generate',

    'oauth2.credentials.get',
    'oauth2.v0.credentials.get',
    'oauth2.v1.credentials.get',

    'oauth2.credentials.list',
    'oauth2.v0.credentials.list',
    'oauth2.v1.credentials.list',

    'oauth2.credentials.redirect_uri.add',
    'oauth2.v0.credentials.redirect_uri.add',
    'oauth2.v1.credentials.redirect_uri.add',

    'oauth2.credentials.redirect_uri.remove',
    'oauth2.v0.credentials.redirect_uri.remove',
    'oauth2.v1.credentials.redirect_uri.remove',

    'oauth2.credentials.remove',
    'oauth2.v0.credentials.remove',
    'oauth2.v1.credentials.remove',

    'oauth2.user.add',
    'oauth2.v0.user.add',
    'oauth2.v1.user.add',

    'oauth2.user.get',
    'oauth2.v0.user.get',
    'oauth2.v1.user.get',

    'oauth2.user.list',
    'oauth2.v0.user.list',
    'oauth2.v1.user.list',

    'oauth2.user.register',
    'oauth2.v0.user.register',
    'oauth2.v1.user.register',

    'oauth2.user.remove',
    'oauth2.v0.user.remove',
    'oauth2.v1.user.remove',

    'oauth2.user.email.link',
    'oauth2.v0.user.email.link',
    'oauth2.v1.user.email.link',

    'oauth2.user.email.verify',
    'oauth2.v0.user.email.verify',
    'oauth2.v1.user.email.verify',

    'oauth2.user.password.link',
    'oauth2.v0.user.password.link',
    'oauth2.v1.user.password.link',

    'oauth2.user.password.reset',
    'oauth2.v0.user.password.reset',
    'oauth2.v1.user.password.reset',

    'oauth2.user.twoFactor.disable',
    'oauth2.v0.user.twoFactor.disable',
    'oauth2.v1.user.twoFactor.disable',

    'oauth2.user.twoFactor.enroll',
    'oauth2.v0.user.twoFactor.enroll',
    'oauth2.v1.user.twoFactor.enroll',

    'oauth2.user.twoFactor.verify',
    'oauth2.v0.user.twoFactor.verify',
    'oauth2.v1.user.twoFactor.verify',

    'operations.add',
    'operations.v0.add',
    'operations.v1.add',

    'operations.get',
    'operations.v0.get',
    'operations.v1.get',

    'operations.list',
    'operations.v0.list',
    'operations.v1.list',

    'operations.next',
    'operations.v0.next',
    'operations.v1.next',

    'operations.remove',
    'operations.v0.remove',
    'operations.v1.remove',

    'operations.update',
    'operations.v0.update',
    'operations.v1.update',

    'speaker.voice.diarize',
    'speaker.v0.voice.diarize',
    'speaker.v1.voice.diarize',

    'speaker.voice.train',
    'speaker.v0.voice.train',
    'speaker.v1.voice.train',

    'speaker.words.diarize',
    'speaker.v0.words.diarize',
    'speaker.v1.words.diarize',

    'speech.detect',
    'speech.v0.detect',
    'speech.v1.detect',

    'speech.transcribe',
    'speech.v0.transcribe',
    'speech.v1.transcribe',

    'storage.analysis.add',
    'storage.v0.analysis.add',
    'storage.v1.analysis.add',

    'storage.analysis.exists',
    'storage.v0.analysis.exists',
    'storage.v1.analysis.exists',

    'storage.analysis.get',
    'storage.v0.analysis.get',
    'storage.v1.analysis.get',

    'storage.analysis.list',
    'storage.v0.analysis.list',
    'storage.v1.analysis.list',

    'storage.analysis.remove',
    'storage.v0.analysis.remove',
    'storage.v1.analysis.remove',

    'storage.analysis.rename',
    'storage.v0.analysis.rename',
    'storage.v1.analysis.rename',

    'storage.audio.add',
    'storage.v0.audio.add',
    'storage.v1.audio.add',

    'storage.audio.exists',
    'storage.v0.audio.exists',
    'storage.v1.audio.exists',

    'storage.audio.get',
    'storage.v0.audio.get',
    'storage.v1.audio.get',

    'storage.audio.getDownloadUrl',
    'storage.v0.audio.getDownloadUrl',
    'storage.v1.audio.getDownloadUrl',

    'storage.audio.getUploadUrl',
    'storage.v0.audio.getUploadUrl',
    'storage.v1.audio.getUploadUrl',

    'storage.audio.list',
    'storage.v0.audio.list',
    'storage.v1.audio.list',

    'storage.audio.move',
    'storage.v0.audio.move',
    'storage.v1.audio.move',

    'storage.audio.process',
    'storage.v0.audio.process',
    'storage.v1.audio.process',

    'storage.audio.remove',
    'storage.v0.audio.remove',
    'storage.v1.audio.remove',

    'storage.audio.uploadFromUrl',
    'storage.v0.audio.uploadFromUrl',
    'storage.v1.audio.uploadFromUrl',

    'storage.features.add',
    'storage.v0.features.add',
    'storage.v1.features.add',

    'storage.features.exists',
    'storage.v0.features.exists',
    'storage.v1.features.exists',

    'storage.features.get',
    'storage.v0.features.get',
    'storage.v1.features.get',

    'storage.features.getDownloadUrl',
    'storage.v0.features.getDownloadUrl',
    'storage.v1.features.getDownloadUrl',

    'storage.features.getUploadUrl',
    'storage.v0.features.getUploadUrl',
    'storage.v1.features.getUploadUrl',

    'storage.features.list',
    'storage.v0.features.list',
    'storage.v1.features.list',

    'storage.features.remove',
    'storage.v0.features.remove',
    'storage.v1.features.remove',

    'storage.features.rename',
    'storage.v0.features.rename',
    'storage.v1.features.rename',

    'storage.folder.add',
    'storage.v0.folder.add',
    'storage.v1.folder.add',

    'storage.folder.exists',
    'storage.v0.folder.exists',
    'storage.v1.folder.exists',

    'storage.folder.get',
    'storage.v0.folder.get',
    'storage.v1.folder.get',

    'storage.folder.list',
    'storage.v0.folder.list',
    'storage.v1.folder.list',

    'storage.model.add',
    'storage.v0.model.add',
    'storage.v1.model.add',

    'storage.model.exists',
    'storage.v0.model.exists',
    'storage.v1.model.exists',

    'storage.model.get',
    'storage.v0.model.get',
    'storage.v1.model.get',

    'storage.model.getDownloadUrl',
    'storage.v0.model.getDownloadUrl',
    'storage.v1.model.getDownloadUrl',

    'storage.model.getUploadUrl',
    'storage.v0.model.getUploadUrl',
    'storage.v1.model.getUploadUrl',

    'storage.model.list',
    'storage.v0.model.list',
    'storage.v1.model.list',

    'storage.model.remove',
    'storage.v0.model.remove',
    'storage.v1.model.remove',

    'storage.model.rename',
    'storage.v0.model.rename',
    'storage.v1.model.rename',

    'webhook.add',
    'webhook.v0.add',
    'webhook.v1.add',

    'webhook.delivery.add',
    'webhook.v0.delivery.add',
    'webhook.v1.delivery.add',

    'webhook.delivery.get',
    'webhook.v0.delivery.get',
    'webhook.v1.delivery.get',

    'webhook.delivery.list',
    'webhook.v0.delivery.list',
    'webhook.v1.delivery.list',

    'webhook.delivery.remove',
    'webhook.v0.delivery.remove',
    'webhook.v1.delivery.remove',

    'webhook.delivery.retry',
    'webhook.v0.delivery.retry',
    'webhook.v1.delivery.retry',

    'webhook.delivery.retryAll',
    'webhook.v0.delivery.retryAll',
    'webhook.v1.delivery.retryAll',

    'webhook.delivery.update',
    'webhook.v0.delivery.update',
    'webhook.v1.delivery.update',

    'webhook.disable',
    'webhook.v0.disable',
    'webhook.v1.disable',

    'webhook.enable',
    'webhook.v0.enable',
    'webhook.v1.enable',

    'webhook.event.add',
    'webhook.v0.event.add',
    'webhook.v1.event.add',

    'webhook.event.get',
    'webhook.v0.event.get',
    'webhook.v1.event.get',

    'webhook.event.next',
    'webhook.v0.event.next',
    'webhook.v1.event.next',

    'webhook.event.remove',
    'webhook.v0.event.remove',
    'webhook.v1.event.remove',

    'webhook.get',
    'webhook.v0.get',
    'webhook.v1.get',

    'webhook.list',
    'webhook.v0.list',
    'webhook.v1.list',

    'webhook.remove',
    'webhook.v0.remove',
    'webhook.v1.remove'

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

    api.oauth2.v0.token.grant = api.oauth2.token.grant;
    api.oauth2.v1.token.grant = api.oauth2.token.grant;

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

    objectpath.set( api, method + '.batch', function ( data, done ) {
      batch( objectpath.get( api, method ), data, done );
    } );

  } );
}

function batch( method, queries, done ) {

  var MAX_BATCH_SIZE = 100;

  var results = [];

  (function next( i, n ) {

    if ( i >= n ) {
      return done( null, results );
    }

    method( queries.slice( i, MAX_BATCH_SIZE ), function ( err, result ) {

      if ( err ) {
        return done( err, results );
      }

      results = results.concat( result );

      next( i + result.length, n );

    } );

  })( 0, queries.length );

}
