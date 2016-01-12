'use strict';

const _         = require( 'lodash' );
const config    = require( '../config' );
const mongoose  = require( 'mongoose' );
const glob      = require( 'glob' );
const Test      = mongoose.models.Test;

const testCases = [];
glob( process.cwd() + '/test-cases/*', function ( err, files ) {
	files.forEach( function ( file ) {
		let fileName = file.split( '/' );
		let data = {
			'filename' : fileName[ fileName.length - 1 ],
			'file'     : file
		}
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
			'path' : '/machines',
			'handler' : function ( request, reply ) {
				return Test
					.aggregate( [
						{
							$group : {
								'_id' : '$machineId',
								'success' : { $sum : '$success' },
								'fail' : { $sum : '$fail' }
							},
						}
					] )
					.exec( function ( error, results ) {
						let machines = [];

						if( error ) {
							return reply( error ).code( 500 );
						}

						for( let i = 0; i < results.length; i++ ) {
							let stats = results[ i ];
							let machine = _.findWhere( config.multiCapabilities, {
								'id' : stats._id
							} );
							machine.stats = results[ i ];
							machines.push( machine );
						}

						return reply( machines );
					} );
			}
		},
		{
			'method' : 'GET',
			'path' : '/machines/{machineId}',
			'handler' : function ( request, reply ) {
				return reply( _.findWhere( config.multiCapabilities, { 'id' : parseInt( request.params.machineId ) } ) );
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

				let id = request.params.testCaseId || 'TC-20.json';
				let jsonfilename = _.findWhere( testCases, { 'filename' : id } );
				let json = require( jsonfilename.file );
				let command = {
					'shell'     : './runner.sh',
					'arguments' : [ escape( JSON.stringify( json ) ), id ]
				};

				console.log( command );

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
							$match : { 'machineId' : parseInt( request.params.machineId ) }
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
						'machineId' : request.params.machineId,
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
				let browserStack      = JSON.parse( payload.browserstack );
				let automationSession = browserStack.automation_session;
				let spec              = payload.spec;
				let success           = 1;
				let fail              = 0;

				if( spec.failedSpecs > 0 ) {
					success = 0;
					fail    = 1;
				}

				var machine = _.findWhere( config.multiCapabilities, {
					'browserName' : automationSession.browser,
					'os'          : automationSession.os,
					'os_version'  : automationSession.os_version
				} );

				let data = {
					'machineId'       : machine.id,
					'browserStackId'  : automationSession.hashed_id,
					'browserStackURL' : automationSession.browser_url,
					'testCaseId'      : request.params.testCaseId,
					'successCount'    : spec.successfulSpecs,
					'failCount'       : spec.failedSpecs,
					'success'         : success,
					'fail'            : fail,
					'endTime'         : spec.endTime
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
