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
  api.host = opts.host || 'https://api.simpleemotion.com';
  api.endpoint = opts.endpoint || '';

  var scope = opts.scope || 'oauth2 directory';
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

  api.communication = {};

  api.communication.endpoint = api.endpoint + '/communication';

  api.communication.email = function ( _id ) {

    if ( !this || this.constructor !== api.communication.email ) {
      return new api.communication.email( _id );
    }

    var resource = api.communication.email.endpoint + '/' + _id;

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : {}, done || data );
    };

  };

  api.communication.email.next = function ( done ) {
    api.request.authorized( 'GET', api.communication.email.endpoint, null, done );
  };

  api.communication.email.queue = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.email.endpoint, data, done );
  };

  api.communication.email.send = {};

  api.communication.email.send.demo = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.email.send.endpoint + '/demo', data, done );
  };

  api.communication.email.send.passwordReset = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.email.send.endpoint + '/passwordReset', data, done );
  };

  api.communication.email.send.verification = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.email.send.endpoint + '/verification', data, done );
  };

  api.communication.email.endpoint = api.communication.endpoint + '/email';

  api.communication.email.send.endpoint = api.communication.email.endpoint + '/send';

  api.communication.sms = function ( _id ) {

    if ( !this || this.constructor !== api.communication.sms ) {
      return new api.communication.sms( _id );
    }

    var resource = api.communication.sms.endpoint + '/' + _id;

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : {}, done || data );
    };
  };

  api.communication.sms.next = function ( data, done ) {
    if ( !done ) {
      done = data;
      data = null;
    }
    api.request.authorized( 'GET', api.communication.sms.endpoint, data, done );
  };

  api.communication.sms.queue = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.sms.endpoint, data, done );
  };

  api.communication.sms.phone = function ( phone ) {

    if ( !this || this.constructor !== api.communication.sms.phone ) {
      return new api.communication.sms.phone( phone );
    }

    var resource = api.communication.sms.phone.endpoint + '/' + phone;

    this.verify = function ( data, done ) {
      api.request.authorized( 'PATCH', resource, done ? data : {}, done || data );
    };

    this.addTwilio = function ( data, done ) {
      api.request.authorized( 'PUT', resource, done ? data : {}, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : {}, done || data );
    };

  };

  api.communication.sms.phone.link = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.sms.phone.endpoint, data, done );
  };

  api.communication.sms.phone.verify = function ( data, done ) {
    api.request.authorized( 'PATCH', api.communication.sms.phone.endpoint + '/', data, done );
  };

  api.communication.sms.phone.link = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.sms.phone.endpoint, data, done );
  };

  api.communication.sms.phone.link = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.sms.phone.endpoint, data, done );
  };

  api.communication.sms.send = {};

  api.communication.sms.send.message = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.sms.send.endpoint, data, done );
  };

  api.communication.sms.send.verification = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.sms.send.endpoint + '/verification', data, done );
  };

  api.communication.sms.endpoint = api.communication.endpoint + '/sms';

  api.communication.sms.phone.endpoint = api.communication.sms.endpoint + '/phone';

  api.communication.sms.send.endpoint = api.communication.sms.endpoint + '/send';

  api.callcenter = {};

  api.callcenter.endpoint = api.endpoint + '/callcenter';

  api.callcenter.analyze = function ( audio_id, done ) {
    api.request.authorized( 'POST', api.callcenter.endpoint + '/analyze/' + audio_id, null, done );
  };

  api.callcenter.detectEvents = function ( audio_id, done ) {
    api.request.authorized( 'POST', api.callcenter.endpoint + '/detectEvents/' + audio_id, null, done );
  };

  api.directory = {};

  api.directory.endpoint = api.endpoint + '/directory';

  api.directory.organization = function ( _id ) {

    if ( !this || this.constructor !== api.directory.organization ) {
      return new api.directory.organization( _id );
    }

    var resource = api.directory.organization.endpoint + '/' + _id;

    this.get = function ( data, done ) {
      api.request.authorized( 'GET', resource, done ? data : {}, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : {}, done || data );
    };

    this.rename = function ( data, done ) {
      api.request.authorized( 'POST', resource + '/rename', done ? data : {}, done || data );
    };

    this.service = {

      endpoint: resource + '/service',

      add: function ( service_id, done ) {
        api.request.authorized( 'POST', this.service.endpoint + '/' + service_id, null, done );
      }.bind( this ),

      remove: function ( service_id, done ) {
        api.request.authorized( 'DELETE', this.service.endpoint + '/' + service_id, null, done );
      }.bind( this )

    };

    this.user = {

      endpoint: resource + '/user',

      add: function ( user_id, done ) {
        api.request.authorized( 'POST', this.user.endpoint + '/' + user_id, null, done );
      }.bind( this ),

      invitation: {

        add: function ( email, done ) {
          api.request.authorized( 'POST', this.user.endpoint + '/invitation/' + email, null, done );
        }.bind( this ),

        remove: function ( email, done ) {
          api.request.authorized( 'DELETE', this.user.endpoint + '/invitation/' + email, null, done );
        }.bind( this )

      },

      list: function ( data, done ) {
        api.request.authorized( 'GET', this.user.endpoint, data, done );
      }.bind( this ),

      remove: function ( user_id, done ) {
        api.request.authorized( 'DELETE', this.user.endpoint + '/' + user_id, null, done );
      }.bind( this )

    };

  };

  api.directory.organization.endpoint = api.directory.endpoint + '/organization';

  api.directory.organization.add = function ( data, done ) {
    api.request.authorized( 'POST', api.directory.organization.endpoint + '/' + data._id, data, done );
  };

  api.directory.organization.list = function ( data, done ) {
    api.request.authorized( 'GET', api.directory.organization.endpoint, data, done );
  };

  api.emotion = {};

  api.emotion.endpoint = api.endpoint + '/emotion';

  api.emotion.classify = function ( audio_id, done ) {
    api.request.authorized( 'POST', api.emotion.endpoint + '/classify/' + audio_id, null, done );
  };

  api.language = {};

  api.language.endpoint = api.endpoint + '/language';

  api.language.analyzeTranscript = function ( audio_id, done ) {
    api.request.authorized( 'POST', api.language.endpoint + '/analyzeTranscript/' + audio_id, null, done );
  };

  api.language.extractProblemSummary = function ( audio_id, done ) {
    api.request.authorized( 'POST', api.language.endpoint + '/extractProblemSummary/' + audio_id, null, done );
  };

  api.oauth2 = {};

  api.oauth2.endpoint = api.endpoint + '/oauth2';

  api.oauth2.credentials = function Credentials( client_id ) {

    if ( !this || this.constructor !== Credentials ) {
      return new Credentials( client_id );
    }

    var resource = api.oauth2.credentials.endpoint + '/' + client_id;

    this.get = function ( data, done ) {
      api.request.authorized( 'GET', resource, done ? data : null, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : null, done || data );
    };

    this.redirect_uri = {};

    this.redirect_uri.add = function ( data, done ) {
      api.request.authorized( 'PUT', resource + '/redirect_uri', done ? data : null, done || data );
    };

    this.redirect_uri.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource + '/redirect_uri', done ? data : null, done || data );
    };

  };

  api.oauth2.credentials.endpoint = api.oauth2.endpoint + '/credentials';

  api.oauth2.credentials.generate = function ( name, role, done ) {

    if ( !done ) {
      done = role;
      role = {};
    }

    api.request.authorized(
      'POST',
      api.oauth2.credentials.endpoint,
      {
        name: name,
        role: role
      },
      function ( err, result ) {

        if ( err ) {
          return done( err, null, null );
        }

        done( err, result );

      }
    );

  };

  api.oauth2.credentials.removeAll = function ( query, done ) {

    if ( !done ) {
      done = query;
      query = {};
    }

    api.request.authorized(
      'DELETE',
      api.oauth2.credentials.endpoint,
      query,
      function ( err, result ) {

        if ( err ) {
          return done( err, null, null );
        }

        done( err, result );

      }
    );

  };

  api.oauth2.credentials.list = function ( data, done ) {
    api.request.authorized( 'GET', api.oauth2.credentials.endpoint, done ? data : null, done || data );
  };

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
          client_id: client_id,
          client_secret: client_secret,
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
        client_id: client_id,
        client_secret: client_secret,
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

  api.oauth2.user = function User( _id ) {

    if ( !this || this.constructor !== User ) {
      return new User( _id );
    }

    var resource = api.oauth2.user.endpoint + '/' + _id;

    this.get = function ( done ) {
      api.request.authorized( 'GET', resource, { _id: _id }, done );
    };

    this.remove = function ( done ) {
      api.request.authorized( 'DELETE', resource, { _id: _id }, done );
    };

    this.twoFactor = {

      disable: function ( otp, done ) {

        var data = { _id: _id, otp: otp };

        if ( !done ) {
          done = otp;
          delete data.otp;
        }

        api.request.authorized( 'DELETE', resource + '/twoFactor', data, done );

      },

      enroll: function ( returnType, done ) {

        var data = { _id: _id, returnType: returnType };

        if ( !done ) {
          done = returnType;
          delete data.returnType;
        }

        api.request.authorized( 'POST', resource + '/twoFactor', data, done );

      },

      verify: function ( otp, done ) {
        api.request.authorized( 'PATCH', resource + '/twoFactor', { _id: _id, otp: otp }, done );
      }

    };

  };

  api.oauth2.user.endpoint = api.oauth2.endpoint + '/user';

  api.oauth2.user.add = function ( data, done ) {
    api.request.authorized( 'POST', api.oauth2.user.endpoint + '/register', data, done );
  };

  api.oauth2.user.list = function ( data, done ) {
    api.request.authorized( 'GET', api.oauth2.user.endpoint, data, done );
  };

  api.oauth2.user.register = function ( data, done ) {
    api.request.authorized( 'POST', api.oauth2.user.endpoint + '/register', data, done );
  };

  api.oauth2.user.removeAll = function ( done ) {
    api.request.authorized( 'DELETE', api.oauth2.user.endpoint, null, done );
  };

  api.operations = {};

  api.operations = function ( _id ) {

    if ( !this || this.constructor !== api.operations ) {
      return new api.operations( _id );
    }

    var resource = api.operations.endpoint + '/' + _id;

    this.get = function ( data, done ) {
      api.request.authorized( 'GET', resource, done ? data : null, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : null, done || data );
    };

    this.update = function ( data, done ) {
      api.request.authorized( 'PATCH', resource, done ? data : null, done || data );
    };

    this.onComplete = function ( poll_rate, done ) {

      if ( !done ) {
        done = poll_rate;
        poll_rate = 1000;
      }

      this.get( function ( err, result ) {

        if ( err ) {
          return done( err, null );
        }

        // Check if operation has completed
        if ( result.operation.states.completed ) {
          return done( null, result );
        }

        // Poll
        setTimeout( this.onComplete.bind( this, poll_rate, done ), poll_rate );

      }.bind( this ) );

    };

    this.listen = function ( action, entity, entity_id, cb, done ) {
      var uri = resource + '?stream=notify' + ( action ? '&action=' + action.toString() : '' ) +
                ( entity ? '&entity=' + entity.toString() : '' ) +
                ( entity_id ? '&entity_id=' + entity_id.toString() : '' );
      api.request.listen( uri, cb, done );
    };

  };

  api.operations.endpoint = api.endpoint + '/operations';

  api.operations.add = function ( data, done ) {
    api.request.authorized( 'POST', api.operations.endpoint, data, done );
  };

  api.operations.list = function ( data, done ) {
    api.request.authorized( 'GET', api.operations.endpoint, done ? data : null, done || data );
  };

  api.operations.next = function ( data, done ) {
    api.request.authorized( 'GET', api.operations.endpoint + '/next', data, done );
  };

  api.speaker = {};

  api.speaker.endpoint = api.endpoint + '/speaker';

  api.speaker.diarize = function ( audio_id, done ) {
    api.request.authorized( 'POST', api.speaker.endpoint + '/diarize/' + audio_id, null, done );
  };

  api.speech = {};

  api.speech.endpoint = api.endpoint + '/speech';

  api.speech.detect = function ( audio_id, done ) {
    api.request.authorized( 'POST', api.speech.endpoint + '/detect/' + audio_id, null, done );
  };

  api.speech.transcribe = function ( audio_id, done ) {
    api.request.authorized( 'POST', api.speech.endpoint + '/transcribe/' + audio_id, null, done );
  };

  api.storage = {};

  api.storage.endpoint = api.endpoint + '/storage';

  api.storage.analysis = function ( _id ) {

    if ( !this || this.constructor !== api.storage.analysis ) {
      return new api.storage.analysis( _id );
    }

    var resource = api.storage.analysis.endpoint + '/' + _id;

    this.get = function ( data, done ) {
      api.request.authorized( 'GET', resource, done ? data : {}, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : {}, done || data );
    };

    this.rename = function ( data, done ) {
      api.request.authorized( 'POST', resource + '/rename', done ? data : {}, done || data );
    };

  };

  api.storage.analysis.endpoint = api.storage.endpoint + '/analysis';

  api.storage.analysis.add = function ( data, done ) {
    api.request.authorized( 'POST', api.storage.analysis.endpoint, data, done );
  };

  api.storage.analysis.list = function ( query, done ) {
    api.request.authorized( 'GET', api.storage.analysis.endpoint, query, done );
  };

  api.storage.audio = function ( _id ) {

    if ( !this || this.constructor !== api.storage.audio ) {
      return new api.storage.audio( _id );
    }

    var resource = api.storage.audio.endpoint + '/' + _id;

    this.get = function ( data, done ) {
      api.request.authorized( 'GET', resource, done ? data : {}, done || data );
    };

    this.getDownloadUrl = function ( data, done ) {
      api.request.authorized( 'GET', resource + '/download.url', done ? data : {}, done || data );
    };

    this.getUploadUrl = function ( data, done ) {
      api.request.authorized( 'GET', resource + '/upload.url', done ? data : {}, done || data );
    };

    this.move = function ( data, done ) {
      api.request.authorized( 'POST', resource + '/move', done ? data : {}, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : {}, done || data );
    };

    this.upload = function ( fd, done ) {
      api.request.stream( 'PUT', resource, fd, done );
    };

  };

  api.storage.audio.endpoint = api.storage.endpoint + '/audio';

  api.storage.audio.add = function ( data, done ) {
    api.request.authorized( 'POST', api.storage.audio.endpoint, data, done );
  };

  api.storage.audio.list = function ( query, done ) {
    api.request.authorized( 'GET', api.storage.audio.endpoint, query, done );
  };

  api.storage.features = function ( _id ) {

    if ( !this || this.constructor !== api.storage.features ) {
      return new api.storage.features( _id );
    }

    var resource = api.storage.features.endpoint + '/' + _id;

    this.get = function ( data, done ) {
      api.request.authorized( 'GET', resource, done ? data : {}, done || data );
    };

    this.getDownloadUrl = function ( data, done ) {
      api.request.authorized( 'GET', resource + '/download.url', done ? data : {}, done || data );
    };

    this.getUploadUrl = function ( data, done ) {
      api.request.authorized( 'GET', resource + '/upload.url', done ? data : {}, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : {}, done || data );
    };

    this.rename = function ( data, done ) {
      api.request.authorized( 'POST', resource + '/rename', done ? data : {}, done || data );
    };

  };

  api.storage.features.endpoint = api.storage.endpoint + '/features';

  api.storage.features.add = function ( data, done ) {
    api.request.authorized( 'POST', api.storage.features.endpoint, data, done );
  };

  api.storage.features.list = function ( query, done ) {
    api.request.authorized( 'GET', api.storage.features.endpoint, query, done );
  };

  api.storage.folder = function ( _id ) {

    if ( !this || this.constructor !== api.storage.folder ) {
      return new api.storage.folder( _id );
    }

    var resource = api.storage.folder.endpoint + '/' + _id;

    this.audio = function ( data, done ) {
      api.request.authorized( 'GET', resource + '/audio', done ? data : {}, done || data );
    };

    this.get = function ( data, done ) {
      api.request.authorized( 'GET', resource, done ? data : {}, done || data );
    };

    this.move = function ( data, done ) {
      api.request.authorized( 'PATCH', resource + '/move', done ? data : {}, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : {}, done || data );
    };

    this.rename = function ( data, done ) {
      api.request.authorized( 'PATCH', resource + '/rename', done ? data : {}, done || data );
    };

  };

  api.storage.folder.endpoint = api.storage.endpoint + '/folder';

  api.storage.folder.add = function ( data, done ) {
    api.request.authorized( 'POST', api.storage.folder.endpoint, data, done );
  };

  api.storage.folder.list = function ( query, done ) {
    api.request.authorized( 'GET', api.storage.folder.endpoint, query, done );
  };

  Object.freeze( this.callcenter );
  Object.freeze( this.communication );
  Object.freeze( this.communication.email );
  Object.freeze( this.communication.email.send );
  Object.freeze( this.communication.sms );
  Object.freeze( this.communication.sms.phone );
  Object.freeze( this.communication.sms.send );
  Object.freeze( this.directory.organization.service );
  Object.freeze( this.directory.organization.user );
  Object.freeze( this.directory.organization );
  Object.freeze( this.directory );
  Object.freeze( this.emotion );
  Object.freeze( this.language );
  Object.freeze( this.oauth2.credentials );
  Object.freeze( this.oauth2.token );
  Object.freeze( this.oauth2.twoFactor );
  Object.freeze( this.oauth2.user );
  Object.freeze( this.operations );
  Object.freeze( this.speaker );
  Object.freeze( this.speech );
  Object.freeze( this.storage.analysis );
  Object.freeze( this.storage.audio );
  Object.freeze( this.storage.features );
  Object.freeze( this.storage.folder );
  Object.freeze( this.storage );
  Object.freeze( this );

}
