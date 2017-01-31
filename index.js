'use strict';

var request = require( 'request' );

module.exports = APIClient;

function APIClient( client_id, client_secret, opts ) {

  if ( !this || this.constructor !== APIClient ) {
    return new APIClient( client_id, client_secret );
  }

  var api = this;

  api.credentials = {
    client_id: client_id,
    client_secret: client_secret
  };

  opts = opts || {};
  api.host = opts.host || 'https://api.simpleemotion.com';
  api.endpoint = '/api';

  var scope = 'oauth2 directory';
  var tokens = {};

  api.request = function ( opts, done ) {
    request( opts, function ( err, res, body ) {

      if ( err ) {
        return done( err, null );
      }

      if ( !res || !body ) {
        return done( new Error( 'No response.' ), null );
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
        Authorization: 'Bearer ' + tokens.access_token
      },
      json: body || {}
    };

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
        api.request.authorized( 'POST', this.user.endpoint + '/' + user_id, { user: { _id: user_id } }, done );
      }.bind( this ),

      invite: function ( email, done ) {
        api.request.authorized( 'POST', this.user.endpoint + '/invite/' + email, null, done );
      }.bind( this ),

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

  api.oauth2 = {};

  api.oauth2.endpoint = api.endpoint + '/oauth2';

  api.oauth2.credentials = function Credentials( client_id ) {

    if ( !this || this.constructor !== Credentials ) {
      return new Credentials( client_id );
    }

    var resource = api.oauth2.endpoint + '/' + client_id;

    this.get = function ( done ) {
      api.request.authorized( 'GET', resource, null, function ( err, result ) {

        if ( err ) {
          return done( err, null );
        }

        done( err, result );

      } );
    };

    this.remove = function ( done ) {
      api.request.authorized( 'DELETE', resource, null, function ( err, result ) {

        if ( err ) {
          return done( err, null );
        }

        done( err, result );

      } );
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

  api.oauth2.credentials.get = function ( client_id, done ) {

    if ( !done ) {
      done = client_id;
      client_id = api.credentials.client_id;
    }

    api.request.authorized(
      'GET',
      api.oauth2.credentials.endpoint + '/' + client_id,
      {},
      function ( err, result ) {

        if ( err ) {
          return done( err, null, null );
        }

        done( err, result );

      }
    );

  };

  api.oauth2.credentials.remove = function ( client_id, done ) {

    if ( !done ) {
      done = client_id;
      client_id = api.credentials.client_id;
    }

    api.request.authorized(
      'DELETE',
      api.oauth2.credentials.endpoint + '/' + client_id,
      {},
      function ( err, result ) {

        if ( err ) {
          return done( err, null, null );
        }

        done( err, result );

      }
    );

  };

  api.oauth2.credentials.list = function ( query, done ) {

    if ( !done ) {
      done = query;
      query = {};
    }

    api.request.authorized( 'GET', api.oauth2.credentials.endpoint, query, done );

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
        access_token: data.access_token,
        refresh_token: tokens.refresh_token,
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
    api.request.authorized( 'POST', api.oauth2.user.endpoint, data, done );
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

  Object.freeze( this.oauth2.credentials );
  Object.freeze( this.oauth2.token );
  Object.freeze( this.oauth2.twoFactor );
  Object.freeze( this.oauth2.user );
  Object.freeze( this.oauth2 );
  Object.freeze( this );

}
