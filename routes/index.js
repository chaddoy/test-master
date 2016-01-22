'use strict';

const _        = require( 'lodash' );
const mongoose = require( 'mongoose' );
const glob     = require( 'glob' );
const Test     = mongoose.models.Test;
const Slave    = mongoose.models.Slave;
const fs       = require( 'fs' );

const protractorConfig   = require( 'protractor-config' );

// Test Cases
const testCases = [];
const logFiles  = [];

const master = require( process.cwd() + '/master' );

glob( process.cwd() + '/testlogs/*', function ( err, files ) {
	files.forEach( function ( file ) {
		let fileName = file.split( '/' );
		let data = {
			'filename' : fileName[ fileName.length - 1 ],
			'file'     : file
		};
		logFiles.push( data );
	} );
} );

glob( process.cwd() + '/observation-public-tests/test/sandbox/converted-jsons/*', function ( err, files ) {
	files.forEach( function ( file ) {
		let fileName = file.split( '/' );
		let data = {
			'filename' : fileName[ fileName.length - 1 ],
			'file'     : file
		};
		testCases.push( data );
	} );
} );

module.exports = function ( master ) {

	return [
		{
			'method' : 'GET',
			'path' : '/test-cases',
			'handler' : function ( request, reply ) {
				return reply( testCases );
			}
		},
		{
			'method' : 'GET',
			'path' : '/test-cases/{testCaseId}',
			'handler' : function ( request, reply ) {
				let id           = request.params.testCaseId || 'TC-20.json';
				let jsonfilename = _.findWhere( testCases, { 'filename' : id } );
				let json         = require( jsonfilename.file );
				return reply( json );
			}
		},
		{
			'method' : 'GET',
			'path' : '/logs/{file}',
			'handler' : function ( request, reply ) {
				fs.readFile( './testlogs/' + request.params.file + '.log', 'utf8', function ( err, data ) {
					if ( err ) {
						return reply( err );
					}
					return reply( data );
				} );
			}
		},
		{
			'method' : 'GET',
			'path' : '/machines',
			'handler' : function ( request, reply ) {

				// loop slave
				return Test
					.aggregate( [
						{
							$group : {
								'_id'     : '$slaveName',
								'success' : { $sum : '$success' },
								'fail'    : { $sum : '$fail' }
							},
						}
					] )
					.exec( function ( error, results ) {

						if( error ) {
							return reply( error ).code( 500 );
						}

						// find in slaves
						var slaves   = master.toArraySlaves();
						let machines = [];
						Slave
							.find( {}, {
								'_id' : 0,
								'__v' : 0
							 } )
							.exec ( function ( slaveError, slavesResult ) {

								if( slaveError ) {
									return reply( slaveError ).code( 500 );
								}

								slavesResult.forEach( ( slave ) => {
									var slaveClone = slave._doc;
									slaveClone.stats = {
										'success' : '0',
										'fail'    : '0'
									};
									_.every( results, ( result, index ) => {
										if ( slaveClone.name === result._id ) {
											slaveClone.stats.success = result.success;
											slaveClone.stats.fail    = result.fail;
											// remove from list for performance
											// but not tested throughly
											results.splice( index, 1 );
											return false;
										} else {
											return true;
										}
									} );
									machines.push( slaveClone );
								} );

								return reply( machines );
							} );
					} );
			}
		},
		{
			'method' : 'GET',
			'path' : '/machines/{machineId}',
			'handler' : function ( request, reply ) {

				Slave
					.find( { 'name' : request.params.machineId }, {
						'_id' : 0,
						'__v' : 0
					 } )
					.exec ( function ( slaveError, slavesResult ) {
						if( slaveError ) {
							return reply( slaveError ).code( 500 );
						}
						return reply( slavesResult );
					} );

			}
		},
		{
			'method' : 'GET',
			'path' : '/vms/{platform}/{machine}/{testCaseId?}',
			'handler' : function ( request, reply ) {

				let machine = {
					'platform' : request.params.platform,
					'machine'  : request.params.machine
				};

				let env = {
					'username' : request.query.username,
					'password' : request.query.password,
				};

				let id = request.params.testCaseId || 'TC-20.json';
				let command = {
					'shell'     : 'runner-local',
					'arguments' : [ id, escape( JSON.stringify( env ) ) ]
				};

				master.exec( machine, command, function ( error, data ) {
					if ( error ) {
						return reply( error.message ).code( 404 );
					}
					return reply( data );
				} );
			}
		},
		{
			'method' : 'GET',
			'path' : '/machines/{machineId}/test-cases',
			'handler' : function ( request, reply ) {
				return Test
					.aggregate( [
						{
							$match : { 'slaveName' : request.params.machineId  }
						},
						{
							$group : {
								'_id' : '$testCaseId',
								'success' : { $sum : '$success' },
								'fail' : { $sum : '$fail' }
							},
						}
					] )
					.exec( function ( error, results ) {
						if( error ) {
							return reply( error ).code( 500 );
						}
						return reply( results );
					} );
			}
		},
		{
			'method' : 'GET',
			'path' : '/machines/{machineId}/test-cases/{testCaseId}',
			'handler' : function ( request, reply ) {
				return Test
					.find( {
						'slaveName' : request.params.machineId,
						'testCaseId' : request.params.testCaseId
					} )
					.exec( function ( error, results ) {
						if( error ) {
							return reply( error ).code( 500 );
						}
						return reply( results );
					} );
			}
		},
		{
			'method' : 'POST',
			'path' : '/machines/{machineId}/test-cases/{testCaseId}',
			'handler' : function ( request, reply ) {

				let payload           = request.payload;
				let browserStack      = payload.browserstack;
				let automationSession = browserStack.automation_session;
				let spec              = payload.spec;
				let success           = 1;
				let fail              = 0;

				if( spec.failedSpecs > 0 ) {
					success = 0;
					fail    = 1;
				}

				let data = {
					'slaveName'       : automationSession.name,
					'browserStackId'  : automationSession.hashed_id,
					'browserStackURL' : automationSession.browser_url,
					'session'         : automationSession.session,
					'testCaseId'      : request.params.testCaseId,
					'successCount'    : spec.successfulSpecs,
					'failCount'       : spec.failedSpecs,
					'success'         : success,
					'fail'            : fail,
					'endTime'         : spec.endTime,
					'duration'        : spec.duration
				};

				let test = new Test( data );
				test.save( function ( err ) {
					if( err ) {
						return reply( 'Bad' ).code( 500 );
					}
					return reply( 'Good' );
				} );
			}
		}
	];

};
