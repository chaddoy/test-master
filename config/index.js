'use strict';

let env = process.env;

module.exports = {
	'mongodb' : env.MONGO || 'mongodb://mongo/e2e',
	'multiCapabilities' : [
		{
			'id'                 : 1,
			'project'            : 'edivate-observe',
			'build'              : 'data-driven',
			'browserName'        : 'ie',
			'browser_version'    : '11.0',
			'os'                 : 'Windows',
			'os_version'         : '10',
			'browserstack.user'  : env.BROWSERSTACK_USER,
			'browserstack.key'   : env.BROWSERSTACK_KEY,
			'browserstack.local' : 'true',
			'browserstack.debug' : 'true'
		},{
			'id'                 : 2,
			'project'            : 'edivate-observe',
			'build'              : 'data-driven',
			'browserName'        : 'edge',
			'browser_version'    : '12.0',
			'os'                 : 'Windows',
			'os_version'         : '10',
			'browserstack.user'  : env.BROWSERSTACK_USER,
			'browserstack.key'   : env.BROWSERSTACK_KEY,
			'browserstack.local' : 'true',
			'browserstack.debug' : 'true'
		},{
			'id'                 : 3,
			'project'            : 'edivate-observe',
			'build'              : 'data-driven',
			'browserName'        : 'ie',
			'browser_version'    : '11.0',
			'os'                 : 'Windows',
			'os_version'         : '8.1',
			'browserstack.user'  : env.BROWSERSTACK_USER,
			'browserstack.key'   : env.BROWSERSTACK_KEY,
			'browserstack.local' : 'true',
			'browserstack.debug' : 'true'
		},{
			'id'                 : 4,
			'project'            : 'edivate-observe',
			'build'              : 'data-driven',
			'browserName'        : 'chrome',
			'browser_version'    : '47.0',
			'os'                 : 'Windows',
			'os_version'         : '8',
			'browserstack.user'  : env.BROWSERSTACK_USER,
			'browserstack.key'   : env.BROWSERSTACK_KEY,
			'browserstack.local' : 'true',
			'browserstack.debug' : 'true'
		},{
			'id'                 : 5,
			'project'            : 'edivate-observe',
			'build'              : 'data-driven',
			'browserName'        : 'chrome',
			'browser_version'    : '47.0',
			'os'                 : 'OS X',
			'os_version'         : 'Yosemite',
			'browserstack.user'  : env.BROWSERSTACK_USER,
			'browserstack.key'   : env.BROWSERSTACK_KEY,
			'browserstack.local' : 'true',
			'browserstack.debug' : 'true'
		}
	]
};
