'use strict';

var request = require( 'request' );
var eventsource = require( 'eventsource' );

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

      try {
        body = JSON.parse( body );
      }
      catch ( err ) {}

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

      // So put the criteria in the header
      else {
        opts.headers[ 'X-GET-CRITERIA' ] = JSON.stringify( body );
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

  // Path is path to resource, cb is on message callback, done is after creation callback
  api.request.listen = function ( path, cb, done ) {

    api.oauth2.token.grant( scope, function ( err, result ) {

      if ( err ) {
        return done( err, null );
      }

      tokens = result;

      var opts = {
        headers: { Authorization: 'Bearer ' + tokens.access_token }
      };

      try {

        var es = new eventsource( api.host + path, opts );

        es.addEventListener( 'message', function ( e ) {
          var message;
          try {
            message = JSON.parse( e.data );
          }
          catch ( e ) {}
          cb( null, message );
        } );

        es.addEventListener( 'error', function ( err ) {
          cb( err, null );
        } );

        done( null, es );
      }
      catch ( err ) {
        done( err, null );
      }

    } );

  };

  api.request.stream = function ( method, path, fd, done ) {

    var opts = {
      method: method,
      uri: api.host + path,
      headers: {}
    };

    api.oauth2.token.grant( scope, function ( err, result ) {

      if ( err ) {
        return done( err, null );
      }

      tokens = result;
      opts.headers.Authorization = 'Bearer ' + tokens.access_token;

      opts.formData = {
        file: fd
      };

      request[ method.toLowerCase() ]( opts, function ( err, res, body ) {

        if ( err ) {
          return done( err, null );
        }

        if ( !res || !body ) {
          return done( new Error( 'No response.' ), null );
        }

        body = JSON.parse( body );

        if ( body.err ) {
          return done( body.err, null );
        }

        done( null, body );

      } );

    } );

  };

  api.getAuthTokens = function () {
    return tokens;
  };

  api.setAuthTokens = function ( auth_tokens ) {
    tokens = auth_tokens || {};
  };

  api.callcenter = {};

  generate(
    api.callcenter,
    api.endpoint + '/callcenter',
    [ 'analyze', 'detectEvents' ]
  );

  api.communication = {
    email: {},
    phone: {},
    sms: {
      send: {}
    }
  };

  generate(
    api.communication.email,
    api.endpoint + '/communication/email',
    [ 'next', 'queue', 'remove' ]
  );

  generate(
    api.communication.phone,
    api.endpoint + '/communication/phone',
    [ 'get', 'link', 'verify', 'remove', 'addTwilio' ]
  );

  generate(
    api.communication.sms,
    api.endpoint + '/communication/sms',
    [ 'next', 'queue', 'remove' ]
  );

  generate(
    api.communication.sms.send,
    api.endpoint + '/communication/sms/send',
    [ 'message', 'verification' ]
  );

  api.directory = {
    organization: {
      service: {},
      user: {
        invitation: {}
      }
    }
  };

  generate(
    api.directory.organization,
    api.endpoint + '/directory/organization',
    [ 'add', 'exists', 'get', 'list', 'remove', 'rename' ]
  );

  generate(
    api.directory.organization.service,
    api.endpoint + '/directory/organization/service',
    [ 'add', 'remove' ]
  );

  generate(
    api.directory.organization.user,
    api.endpoint + '/directory/organization/user',
    [ 'add', 'list', 'remove' ]
  );

  generate(
    api.directory.organization.user.invitation,
    api.endpoint + '/directory/organization/user/invitation',
    [ 'add', 'remove' ]
  );

  api.emotion = {};

  generate(
    api.emotion,
    api.endpoint + '/emotion',
    [ 'classify' ]
  );

  api.language = {};

  generate(
    api.language,
    api.endpoint + '/language',
    [ 'analyzeTranscript', 'extractProblemSummary' ]
  );

  api.oauth2 = {
    credentials: {
      redirect_uri: {}
    },
    user: {
      email: {},
      password: {},
      twoFactor: {}
    }
  };

  api.oauth2.endpoint = api.endpoint + '/oauth2';

  api.oauth2.token = function Token( token ) {

    if ( !this || this.constructor !== Token ) {
      return new Token( token );
    }

    this.grant = function ( scope, done ) {
      // TODO: SUPPORT TWO_FACTOR AND REFRESH_TOKEN
    };

    this.revoke = function ( done ) {

      var opts = {
        method: 'POST',
        uri: api.host + api.oauth2.endpoint + '/revoke',
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
      uri: api.host + api.oauth2.endpoint + '/token',
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

  generate(
    api.oauth2.credentials,
    api.endpoint + '/oauth2/credentials',
    [ 'generate', 'get', 'list', 'remove' ]
  );

  generate(
    api.oauth2.credentials.redirect_uri,
    api.endpoint + '/oauth2/credentials/redirect_uri',
    [ 'add', 'remove' ]
  );

  generate(
    api.oauth2.user,
    api.endpoint + '/oauth2/user',
    [ 'add', 'get', 'list', 'register', 'remove' ]
  );

  generate(
    api.oauth2.user.email,
    api.endpoint + '/oauth2/user/email',
    [ 'link', 'verify' ]
  );

  generate(
    api.oauth2.user.password,
    api.endpoint + '/oauth2/user/password',
    [ 'link', 'reset' ]
  );

  generate(
    api.oauth2.user.twoFactor,
    api.endpoint + '/oauth2/user/twoFactor',
    [ 'disable', 'enroll', 'verify' ]
  );

  api.operations = {};

  generate(
    api.operations,
    api.endpoint + '/operations',
    [ 'add', 'get', 'list', 'next', 'remove', 'update' ]
  );

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

  api.speaker = {
    diarize: {}
  };

  generate(
    api.speaker.diarize,
    api.endpoint + '/speaker/diarize',
    [ 'voice', 'words' ]
  );

  generate(
    api.speaker,
    api.endpoint + '/speaker',
    [ 'train' ]
  );

  api.speech = {};

  generate(
    api.speech,
    api.endpoint + '/speech',
    [ 'detect', 'transcribe' ]
  );

  api.storage = {
    analysis: {},
    audio: {},
    features: {},
    folder: {},
    model: {}
  };

  generate(
    api.storage.analysis,
    api.endpoint + '/storage/analysis',
    [ 'add', 'exists', 'get', 'list', 'remove', 'rename' ]
  );

  generate(
    api.storage.audio,
    api.endpoint + '/storage/audio',
    [ 'add', 'exists', 'get', 'getDownloadUrl', 'getUploadUrl', 'list', 'move', 'process', 'remove', 'uploadFromUrl' ]
  );

  generate(
    api.storage.features,
    api.endpoint + '/storage/features',
    [ 'add', 'exists', 'get', 'list', 'getDownloadUrl', 'getUploadUrl', 'remove', 'rename' ]
  );

  generate(
    api.storage.folder,
    api.endpoint + '/storage/folder',
    [ 'add', 'exists', 'get', 'list' ]
  );

  generate(
    api.storage.model,
    api.endpoint + '/storage/model',
    [ 'add', 'exists', 'get', 'getDownloadUrl', 'getUploadUrl', 'list', 'remove', 'rename' ]
  );

  api.webhook = {
    delivery: {},
    event: {}
  };

  generate(
    api.webhook,
    api.endpoint + '/webhook',
    [ 'add', 'disable', 'enable', 'get', 'list', 'remove' ]
  );

  generate(
    api.webhook.delivery,
    api.endpoint + '/webhook/delivery',
    [ 'add', 'get', 'list', 'retry', 'retryAll', 'update' ]
  );

  generate(
    api.webhook.event,
    api.endpoint + '/webhook/event',
    [ 'add', 'get', 'remove' ]
  );

  function generate( path, endpoint, methods ) {
    methods.forEach( function ( method ) {
      path[ method ] = function ( data, done ) {
        api.request.authorized( 'POST', endpoint + '/' + method, data, done );
      };
    } );
  }

}
