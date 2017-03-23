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

  api.communication = {};

  api.communication.endpoint = api.endpoint + '/communication';

  api.communication.email = function ( _id ) {

    if ( !this || this.constructor !== api.communication.email ) {
      return new api.communication.email( _id );
    }

    var resource = api.communication.email.endpoint + '/' + _id;

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : null, done || data );
    };

  };

  api.communication.email.next = function ( done ) {
    api.request.authorized( 'GET', api.communication.email.endpoint, null, done );
  };

  api.communication.email.queue = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.email.endpoint, data, done );
  };

  api.communication.email.endpoint = api.communication.endpoint + '/email';

  api.communication.sms = function ( _id ) {

    if ( !this || this.constructor !== api.communication.sms ) {
      return new api.communication.sms( _id );
    }

    var resource = api.communication.sms.endpoint + '/' + _id;

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : null, done || data );
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

  api.communication.sms.send = {};

  api.communication.sms.send.message = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.sms.send.endpoint, data, done );
  };

  api.communication.sms.send.verification = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.sms.send.endpoint + '/verification', data, done );
  };

  api.communication.sms.endpoint = api.communication.endpoint + '/sms';

  api.communication.sms.send.endpoint = api.communication.sms.endpoint + '/send';

  api.communication.phone = function ( phone ) {

    if ( !this || this.constructor !== api.communication.phone ) {
      return new api.communication.phone( phone );
    }

    var resource = api.communication.phone.endpoint + '/' + phone;

    this.verify = function ( data, done ) {
      api.request.authorized( 'PATCH', resource, done ? data : null, done || data );
    };

    this.addTwilio = function ( data, done ) {
      api.request.authorized( 'PUT', resource, done ? data : null, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : null, done || data );
    };

  };

  api.communication.phone.link = function ( data, done ) {
    api.request.authorized( 'POST', api.communication.phone.endpoint, data, done );
  };

  api.communication.phone.get = function ( data, done ) {
    api.request.authorized( 'GET', api.communication.phone.endpoint, data, done );
  };

  api.communication.phone.endpoint = api.communication.endpoint + '/phone';

  api.directory = {};

  api.directory.endpoint = api.endpoint + '/directory';

  api.directory.organization = function ( _id ) {

    if ( !this || this.constructor !== api.directory.organization ) {
      return new api.directory.organization( _id );
    }

    var resource = api.directory.organization.endpoint + '/' + _id;

    this.get = function ( data, done ) {
      api.request.authorized( 'GET', resource, done ? data : null, done || data );
    };

    this.remove = function ( data, done ) {
      api.request.authorized( 'DELETE', resource, done ? data : null, done || data );
    };

    this.rename = function ( data, done ) {
      api.request.authorized( 'POST', resource + '/rename', done ? data : null, done || data );
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

    this.email = {

      link: function ( data, done ) {
        if ( !done ) {
          done = data;
          data = {};
        }

        api.request.authorized( 'POST', resource + '/verify', data, done );
      },

      verify: function ( data, done ) {
        if ( !done ) {
          done = data;
          data = {};
        }

        api.request.authorized( 'PATCH', resource + '/verify/' + data.code, data, done );
      }

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

  api.oauth2.user.password = {};

  api.oauth2.user.password.link = function ( data, done ) {
    api.request.authorized( 'POST', api.oauth2.user.endpoint + '/password-reset', data, done );
  };

  api.oauth2.user.password.reset = function ( data, done ) {
    api.request.authorized( 'PATCH', api.oauth2.user.endpoint + '/password-reset/' + data.code, data, done );
  };

  api.operations = {};

  generate(
    api.operations,
    api.endpoint + '/operations',
    [ 'add', 'get', 'list', 'next', 'remove', 'update' ]
  );

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

  function generate( path, endpoint, methods ) {
    methods.forEach( function ( method ) {
      path[ method ] = function ( data, done ) {
        api.request.authorized( 'POST', endpoint + '/' + method, data, done );
      };
    } );
  }

}
