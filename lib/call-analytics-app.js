'use strict';

const { promisify: p } = require( 'util' );
const axios = require( 'axios' );
const objectpath = require( 'object-path' );
const URLTemplate = require( 'url-template' );

const MAX_RETRY_COUNT = 5;

const methods = [

  { endpoint: '/authorize', method: 'POST', path: 'authorize', public: true },

  // Agents
  { endpoint: '/agents', method: 'POST', path: 'agent.add' },
  { endpoint: '/agents', method: 'GET', path: 'agent.list' },
  { endpoint: '/agents/{agentId}', method: 'GET', path: 'agent.get' },
  { endpoint: '/agents/{agentId}', method: 'DELETE', path: 'agent.remove' },

  // Audio
  { endpoint: '/agents/{agentId}', method: 'PATCH', path: 'agent.update' },
  { endpoint: '/audio/get', method: 'POST', path: 'audio.get' },
  { endpoint: '/audio/list', method: 'POST', path: 'audio.list' },
  { endpoint: '/audio/rebuild', method: 'POST', path: 'audio.rebuild' },
  { endpoint: '/audio/unique', method: 'POST', path: 'audio.unique' },

  // Audio bucket
  { endpoint: '/audio/{audioId}/wav', method: 'GET', path: 'audio.wav' },
  { endpoint: '/audio/bucket/agent', method: 'POST', path: 'audio.bucket.agent' },
  { endpoint: '/audio/bucket/time', method: 'POST', path: 'audio.bucket.time' },

  // Audio export
  { endpoint: '/audio/bucket2D', method: 'POST', path: 'audio.bucket2D' },
  { endpoint: '/audio/export', method: 'POST', path: 'audio.export.add' },
  { endpoint: '/audio/export/{exportId}', method: 'GET', path: 'audio.export.get' },

  // Audio comments
  { endpoint: '/audio/export/{exportId}/download/{filename}', method: 'GET', path: 'audio.export.download' },
  { endpoint: '/audio/{audioId}/comments', method: 'GET', path: 'audio.comment.list' },
  { endpoint: '/audio/{audioId}/comments', method: 'POST', path: 'audio.comment.add' },
  { endpoint: '/audio/{audioId}/comments/{commentId}', method: 'GET', path: 'audio.comment.get' },
  { endpoint: '/audio/{audioId}/comments/{commentId}', method: 'PATCH', path: 'audio.comment.update' },

  // Audio conversation
  { endpoint: '/audio/{audioId}/comments/{commentId}', method: 'DELETE', path: 'audio.comment.remove' },
  { endpoint: '/audio/{audioId}/conversation', method: 'GET', path: 'audio.conversation.get' },

  // Audio playbooks
  { endpoint: '/audio/{audioId}/conversation/url', method: 'GET', path: 'audio.conversation.url.get' },

  // Audio workflows
  { endpoint: '/audio/{audioId}/playbooks/lines/{lineId}/match', method: 'PATCH', path: 'audio.playbook.line.match' },
  { endpoint: '/audio/{audioId}/workflows/{workflowId}/assign', method: 'PATCH', path: 'audio.workflow.assign' },

  // Dashboards
  { endpoint: '/audio/{audioId}/workflows/{workflowId}/review', method: 'PATCH', path: 'audio.workflow.review' },
  { endpoint: '/dashboard/add', method: 'POST', path: 'dashboard.add' },
  { endpoint: '/dashboard/get', method: 'POST', path: 'dashboard.get' },
  { endpoint: '/dashboard/list', method: 'POST', path: 'dashboard.list' },
  { endpoint: '/dashboard/remove', method: 'POST', path: 'dashboard.remove' },

  // Dashboard widgets
  { endpoint: '/dashboard/update', method: 'POST', path: 'dashboard.update' },
  { endpoint: '/dashboard/widget/add', method: 'POST', path: 'dashboard.widget.add' },
  { endpoint: '/dashboard/widget/get', method: 'POST', path: 'dashboard.widget.get' },
  { endpoint: '/dashboard/widget/list', method: 'POST', path: 'dashboard.widget.list' },
  { endpoint: '/dashboard/widget/remove', method: 'POST', path: 'dashboard.widget.remove' },

  // Filters
  { endpoint: '/dashboard/widget/update', method: 'POST', path: 'dashboard.widget.update' },
  { endpoint: '/filters', method: 'POST', path: 'filter.add' },
  { endpoint: '/filters', method: 'GET', path: 'filter.list' },
  { endpoint: '/filters/{filterName}', method: 'GET', path: 'filter.get' },
  { endpoint: '/filters/{filterName}', method: 'DELETE', path: 'filter.remove' },

  // Keywords
  { endpoint: '/filters/{filterName}', method: 'PATCH', path: 'filter.update' },
  { endpoint: '/keywords', method: 'POST', path: 'keyword.add' },
  { endpoint: '/keywords', method: 'GET', path: 'keyword.list' },
  { endpoint: '/keywords/{keywordId}', method: 'GET', path: 'keyword.get' },
  { endpoint: '/keywords/{keywordId}', method: 'DELETE', path: 'keyword.remove' },

  // Organizations
  { endpoint: '/keywords/{keywordId}', method: 'PATCH', path: 'keyword.update' },
  { endpoint: '/organizations', method: 'GET', path: 'organization.list' },
  { endpoint: '/organizations/{organizationId}', method: 'GET', path: 'organization.get' },

  // Organization users
  { endpoint: '/organizations/{organizationId}/data', method: 'GET', path: 'organization.getDataLists' },
  { endpoint: '/organizations/{organizationId}/users', method: 'GET', path: 'organization.user.list' },
  {
    endpoint: '/organizations/{organizationId}/users/admins/{userId}',
    method: 'PUT',
    path: 'organization.user.admin.add'
  },

  // Playbooks
  {
    endpoint: '/organizations/{organizationId}/users/admins/{userId}',
    method: 'DELETE',
    path: 'organization.user.admin.remove'
  },
  { endpoint: '/playbooks', method: 'POST', path: 'playbook.add' },
  { endpoint: '/playbooks', method: 'GET', path: 'playbook.list' },
  { endpoint: '/playbooks/{playbookId}', method: 'GET', path: 'playbook.get' },
  { endpoint: '/playbooks/{playbookId}', method: 'DELETE', path: 'playbook.remove' },

  // Playbook lines
  { endpoint: '/playbooks/{playbookId}', method: 'PATCH', path: 'playbook.update' },
  { endpoint: '/playbooks/{playbookId}/lines', method: 'POST', path: 'playbook.line.add' },
  { endpoint: '/playbooks/{playbookId}/lines', method: 'GET', path: 'playbook.line.list' },
  { endpoint: '/playbooks/{playbookId}/lines', method: 'DELETE', path: 'playbook.line.removeAll' },
  { endpoint: '/playbooks/{playbookId}/lines/{lineId}', method: 'GET', path: 'playbook.line.get' },
  { endpoint: '/playbooks/{playbookId}/lines/{lineId}', method: 'DELETE', path: 'playbook.line.remove' },

  // Preferences
  { endpoint: '/playbooks/{playbookId}/lines/{lineId}', method: 'PATCH', path: 'playbook.line.update' },
  { endpoint: '/preferences/add', method: 'POST', path: 'preferences.add' },
  { endpoint: '/preferences/addHint', method: 'POST', path: 'preferences.addHint' },
  { endpoint: '/preferences/get', method: 'POST', path: 'preferences.get' },
  { endpoint: '/preferences/list', method: 'POST', path: 'preferences.list' },
  { endpoint: '/preferences/remove', method: 'POST', path: 'preferences.remove' },
  { endpoint: '/preferences/removeHint', method: 'POST', path: 'preferences.removeHint' },

  // Reports
  { endpoint: '/preferences/update', method: 'POST', path: 'preferences.update' },
  { endpoint: '/reports', method: 'POST', path: 'report.add' },
  { endpoint: '/reports', method: 'GET', path: 'report.list' },
  { endpoint: '/reports/{reportId}', method: 'GET', path: 'report.get' },
  { endpoint: '/reports/{reportId}', method: 'DELETE', path: 'report.remove' },

  // Service
  { endpoint: '/reports/{reportId}', method: 'PATCH', path: 'report.update' },
  {
    endpoint: '/service/integration/talkdesk/agents/import',
    method: 'POST',
    path: 'service.integration.talkdesk.agent.import'
  },
  { endpoint: '/service/provision/check', method: 'POST', path: 'service.provision.check' },
  { endpoint: '/service/provision/organization', method: 'POST', path: 'service.provision.organization' },

  // User
  { endpoint: '/service/provision/user', method: 'POST', path: 'service.provision.user' },
  { endpoint: '/user/acknowledge', method: 'POST', path: 'user.acknowledge' },
  { endpoint: '/user/completeTutorial', method: 'POST', path: 'user.completeTutorial' },
  { endpoint: '/user/get', method: 'POST', path: 'user.get' },
  { endpoint: '/user/register', method: 'POST', path: 'user.register' },
  { endpoint: '/user/session/remove', method: 'POST', path: 'user.session.remove' },

  // Workflows
  { endpoint: '/workflows', method: 'POST', path: 'workflow.add' },
  { endpoint: '/workflows', method: 'GET', path: 'workflow.list' },
  { endpoint: '/workflows/{workflowId}', method: 'GET', path: 'workflow.get' },
  { endpoint: '/workflows/{workflowId}', method: 'DELETE', path: 'workflow.remove' },
  { endpoint: '/workflows/{workflowId}', method: 'PATCH', path: 'workflow.update' },
  { endpoint: '/workflows/{workflowId}/audio', method: 'GET', path: 'workflow.audio.list' }

];

module.exports = class APIClient {

  constructor( SEAPI, opts ) {

    this.SEAPI = SEAPI;
    this.opts = Object.assign( {}, opts );

    this.opts.logger = this.opts.logger || console;

    this.opts.host = this.opts.host || 'https://call-analytics.simpleemotion.com';
    this.opts.endpoint = this.opts.endpoint || '/api/v2';

    for ( const { path, method, endpoint, public: noAuth } of methods ) {
      objectpath.set(
        this,
        path,
        data => this.request(
          method,
          URLTemplate.parse( endpoint ).expand( data ),
          data,
          noAuth || false
        )
      );
    }

  }

  request( method, path, data, noAuth ) {

    if ( !this.access_token && !noAuth ) {
      return reauthorize.call( this );
    }

    return request.call(
      this,
      {
        url: this.opts.host + this.opts.endpoint + path,
        method: method,
        headers: {
          ...( noAuth || { 'Authorization': `Bearer ${this.access_token}` } ),
          'Content-Type': 'application/json'
        },
        ...( method.toUpperCase() === 'GET' ? { params: flatten( data ) } : { data } ),
        timeout: 30 * 1000
      }
    ).catch( err => {

      // Throw error for non-authentication errors
      if ( err.response.status !== 401 ) {
        throw err;
      }

      return reauthorize.call( this );

    } );

    function request( req, retry_count = 0 ) {

      if ( this.opts.debug ) {
        this.opts.logger.log( req );
      }

      return axios( req ).catch( err => {

        if ( err.response.status === 502 && retry_count < MAX_RETRY_COUNT ) {
          return request( req, retry_count + 1 );
        }

        throw err;

      } );

    }

    async function reauthorize() {
      const { access_token } = await p( this.SEAPI.oauth2.v1.token.grant )( this.SEAPI.scope );
      const res = await this.authorize( { access_token } );
      this.access_token = res.data.access_token;
      return this.request( method, path, data, noAuth );
    }

  }

};

function flatten( object, prefix = '' ) {
  Object.keys( object ).reduce(
    ( prev, element ) =>
      object[ element ] &&
      typeof object[ element ] === 'object' &&
      !Array.isArray( object[ element ] ) ?
        { ...prev, ...flatten( object[ element ], `${prefix}${element}.` ) } :
        { ...prev, ...{ [ `${prefix}${element}` ]: object[ element ] } },
    {}
  );
}
