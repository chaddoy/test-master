'use strict';

let env = process.env;

module.exports = {
	'mongodb' : env.MONGO || 'mongodb://localhost/e2e'
};
