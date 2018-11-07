'use strict';

const request = require( 'request' );
const objectpath = require( 'object-path' );
const { compile } = require( 'path-to-regexp' );

const MAX_RETRY_COUNT = 5;

module.exports = APIClient;

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

  api.authorization = {
    protocol: opts.authorization.protocol || 'https',
    host: opts.authorization.host || 'https://api.simpleemotion.com',
    endpoint: opts.authorization.endpoint || ''
  };

  api.protocol = opts.protocol || 'https';
  api.host = opts.host || 'https://call-analytics.simpleemotion.com';
  api.endpoint = opts.endpoint || '/api/v2';

  const scope = opts.scope || '';
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

  const methods = [
    { path: 'agent.update', endpoint: 'agent/:agentId', method: 'PATCH' },

    { endpoint: '/agents', method: 'POST', path: 'agent.add' },
    { endpoint: '/agents', method: 'GET', path: 'agent.list' },
    { endpoint: '/agents/:agentId', method: 'GET', path: 'agent.get' },
    { endpoint: '/agents/:agentId', method: 'DELETE', path: 'agent.remove' },
    { endpoint: '/agents/:agentId', method: 'PATCH', path: 'agent.update' },
    { endpoint: '/audio/bucket/agent', method: 'POST', path: 'audio.bucket.agent' },
    { endpoint: '/audio/bucket/time', method: 'POST', path: 'audio.bucket.time' },
    { endpoint: '/audio/bucket2D', method: 'POST', path: 'audio.bucket2D' },
    { endpoint: '/audio/export', method: 'POST', path: 'audio.export.add' },
    { endpoint: '/audio/export/:exportId', method: 'GET', path: 'audio.export.get' },
    { endpoint: '/audio/export/:exportId/download/:filename?', method: 'GET', path: 'audio.export.download' },
    { endpoint: '/audio/get', method: 'POST', path: 'audio.get' },
    { endpoint: '/audio/list', method: 'POST', path: 'audio.list' },
    { endpoint: '/audio/rebuild', method: 'POST', path: 'audio.rebuild' },
    { endpoint: '/audio/unique', method: 'POST', path: 'audio.unique' },
    { endpoint: '/audio/:audioId/comments', method: 'GET', path: 'audio.comment.list' },
    { endpoint: '/audio/:audioId/comments', method: 'POST', path: 'audio.comment.add' },
    { endpoint: '/audio/:audioId/comments/:commentId', method: 'GET', path: 'audio.comment.get' },
    { endpoint: '/audio/:audioId/comments/:commentId', method: 'PATCH', path: 'audio.comment.update' },
    { endpoint: '/audio/:audioId/comments/:commentId', method: 'DELETE', path: 'audio.comment.remove' },
    { endpoint: '/audio/:_id/conversation', method: 'GET', path: 'audio.conversation.get' },
    { endpoint: '/audio/:_id/conversation/url', method: 'GET', path: 'audio.conversation.url.get' },
    { endpoint: '/audio/:_id/playbooks/lines/:lineId/match', method: 'PATCH', path: 'audio.playbook.line.match' },
    { endpoint: '/audio/:_id/wav', method: 'GET', path: 'audio.wav' },
    { endpoint: '/audio/:audioId/workflows/:workflowId/assign', method: 'PATCH', path: 'audio.workflow.assign' },
    { endpoint: '/audio/:audioId/workflows/:workflowId/review', method: 'PATCH', path: 'audio.workflow.review' },
    { endpoint: '/dashboard/add', method: 'POST', path: 'dashboard.add' },
    { endpoint: '/dashboard/get', method: 'POST', path: 'dashboard.get' },
    { endpoint: '/dashboard/list', method: 'POST', path: 'dashboard.list' },
    { endpoint: '/dashboard/remove', method: 'POST', path: 'dashboard.remove' },
    { endpoint: '/dashboard/update', method: 'POST', path: 'dashboard.update' },
    { endpoint: '/dashboard/widget/add', method: 'POST', path: 'dashboard.widget.add' },
    { endpoint: '/dashboard/widget/get', method: 'POST', path: 'dashboard.widget.get' },
    { endpoint: '/dashboard/widget/list', method: 'POST', path: 'dashboard.widget.list' },
    { endpoint: '/dashboard/widget/remove', method: 'POST', path: 'dashboard.widget.remove' },
    { endpoint: '/dashboard/widget/update', method: 'POST', path: 'dashboard.widget.update' },
    { endpoint: '/customer/list', method: 'POST', path: 'customer.list' },
    { endpoint: '/filters', method: 'POST', path: 'filter.add' },
    { endpoint: '/filters', method: 'GET', path: 'filter.list' },
    { endpoint: '/filters/:filterName', method: 'GET', path: 'filter.get' },
    { endpoint: '/filters/:filterName', method: 'DELETE', path: 'filter.remove' },
    { endpoint: '/filters/:filterName', method: 'PATCH', path: 'filter.update' },
    { endpoint: '/groups/ring-groups/list', method: 'POST', path: 'group.ringGroup.list' },
    { endpoint: '/keywords', method: 'POST', path: 'keyword.add' },
    { endpoint: '/keywords', method: 'GET', path: 'keyword.list' },
    { endpoint: '/keywords/:keywordId', method: 'GET', path: 'keyword.get' },
    { endpoint: '/keywords/:keywordId', method: 'DELETE', path: 'keyword.remove' },
    { endpoint: '/keywords/:keywordId', method: 'PATCH', path: 'keyword.update' },
    { endpoint: '/organizations', method: 'GET', path: 'organization.list' },
    { endpoint: '/organizations/:organizationId', method: 'GET', path: 'organization.get' },
    {
      endpoint: '/organizations/:organizationId/completeAdminRegistration',
      method: 'POST',
      path: 'organization.completeAdminRegistration'
    },
    { endpoint: '/organizations/:organizationId/data', method: 'GET', path: 'organization.getDataLists' },
    { endpoint: '/organizations/:organizationId/users', method: 'GET', path: 'organization.user.list' },
    {
      endpoint: '/organizations/:organizationId/users/admins/:userId',
      method: 'PUT',
      path: 'organization.user.admin.add'
    },
    {
      endpoint: '/organizations/:organizationId/users/admins/:userId',
      method: 'DELETE',
      path: 'organization.user.admin.remove'
    },
    { endpoint: '/playbooks', method: 'POST', path: 'playbook.add' },
    { endpoint: '/playbooks', method: 'GET', path: 'playbook.list' },
    { endpoint: '/playbooks/:playbookId', method: 'GET', path: 'playbook.get' },
    { endpoint: '/playbooks/:playbookId', method: 'DELETE', path: 'playbook.remove' },
    { endpoint: '/playbooks/:playbookId', method: 'PATCH', path: 'playbook.update' },
    { endpoint: '/playbooks/:playbookId/lines', method: 'POST', path: 'playbook.line.add' },
    { endpoint: '/playbooks/:playbookId/lines', method: 'GET', path: 'playbook.line.list' },
    { endpoint: '/playbooks/:playbookId/lines', method: 'DELETE', path: 'playbook.line.removeAll' },
    { endpoint: '/playbooks/:playbookId/lines/:lineId', method: 'GET', path: 'playbook.line.get' },
    { endpoint: '/playbooks/:playbookId/lines/:lineId', method: 'DELETE', path: 'playbook.line.remove' },
    { endpoint: '/playbooks/:playbookId/lines/:lineId', method: 'PATCH', path: 'playbook.line.update' },
    { endpoint: '/preferences/add', method: 'POST', path: 'preferences.add' },
    { endpoint: '/preferences/addHint', method: 'POST', path: 'preferences.addHint' },
    { endpoint: '/preferences/get', method: 'POST', path: 'preferences.get' },
    { endpoint: '/preferences/list', method: 'POST', path: 'preferences.list' },
    { endpoint: '/preferences/remove', method: 'POST', path: 'preferences.remove' },
    { endpoint: '/preferences/removeHint', method: 'POST', path: 'preferences.removeHint' },
    { endpoint: '/preferences/update', method: 'POST', path: 'preferences.update' },
    { endpoint: '/reports', method: 'POST', path: 'report.add' },
    { endpoint: '/reports', method: 'GET', path: 'report.list' },
    { endpoint: '/reports/:reportId', method: 'GET', path: 'report.get' },
    { endpoint: '/reports/:reportId', method: 'DELETE', path: 'report.remove' },
    { endpoint: '/reports/:reportId', method: 'PATCH', path: 'report.update' },
    { endpoint: '/service/provision/check', method: 'POST', path: 'service.provision.check' },
    { endpoint: '/service/provision/user', method: 'POST', path: 'service.provision.user' },
    { endpoint: '/service/provision/organization', method: 'POST', path: 'service.provision.organization' },
    {
      endpoint: '/service/integration/talkdesk/agents/import',
      method: 'POST',
      path: 'service.integration.talkdesk.agent.import'
    },
    { endpoint: '/user/get', method: 'POST', path: 'user.get' },
    { endpoint: '/user/register', method: 'POST', path: 'user.register' },
    { endpoint: '/user/completeTutorial', method: 'POST', path: 'user.completeTutorial' },
    { endpoint: '/user/acknowledge', method: 'POST', path: 'user.acknowledge' },
    { endpoint: '/user/session/remove', method: 'POST', path: 'user.session.remove' },
    { endpoint: '/user/verify', method: 'POST', path: 'user.verify' },
    { endpoint: '/user/password/request', method: 'POST', path: 'user.password.request' },
    { endpoint: '/user/password/reset', method: 'POST', path: 'user.password.reset' },
    { endpoint: '/workflows', method: 'POST', path: 'workflow.add' },
    { endpoint: '/workflows', method: 'GET', path: 'workflow.list' },
    { endpoint: '/workflows/:workflowId', method: 'GET', path: 'workflow.get' },
    { endpoint: '/workflows/:workflowId', method: 'DELETE', path: 'workflow.remove' },
    { endpoint: '/workflows/:workflowId', method: 'PATCH', path: 'workflow.update' },
    { endpoint: '/workflows/:workflowId/audio', method: 'GET', path: 'workflow.audio.list' }

  ];

  generate( api, methods );

  api.oauth2.v1.token = function Token( token ) {

    if ( !this || this.constructor !== Token ) {
      return new Token( token );
    }

    this.revoke = function ( done ) {

      const opts = {
        method: 'POST',
        uri: api.authorization.host + api.authorization.endpoint + '/oauth2/revoke',
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
      uri: api.authorization.host + api.authorization.endpoint + '/oauth2/token',
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

}

function generate( api, methods ) {
  methods.forEach( function ( method ) {

    objectpath.set( api, method.path, function ( data, done ) {
      api.request.authorized( method.method, api.endpoint + '/' + compile( method.endpoint )( data ), data, done );
    } );

    objectpath.set( api, method.path + '.batch', function ( data, done ) {
      batch( objectpath.get( api, method.path ), data, done );
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
