'use strict';

const _        = require( 'lodash' );
const fs       = require( 'fs' );
const Hapi     = require( 'hapi' );
const SocketIO = require( 'socket.io' );
const server   = new Hapi.Server();
const Master   = require( './master' );
const master   = new Master();
const mongoose = require( 'mongoose' );
const config   = require( './config' );

const protractorConfig = require( 'protractor-config' );

mongoose.connect( config.mongodb );
require( './models/Tests' );

// Start the master to listen
master.on( 'listening', ( masterServer ) => {} );
master.on( 'error', ( error ) => {
	console.log( error );
} );

server.connection( {
	'port' : 3400,
	'labels' : 'rest',
	'routes' : {
		'cors' : {
			'origin' : [ '*' ]
		}
	}
} );

server.connection( {
	'port' : 3401,
	'labels' : 'ws'
} );

server.connection( {
	'port' : 3402,
	'labels' : 'static'
} );

const rest        = server.select( 'rest' );
const ws          = server.select( 'ws' );
const staticFiles = server.select( 'static' );

// Rest API
rest.route( require( './routes' )( master ) );

const io      = SocketIO.listen( ws.listener );
const logPath = process.cwd() + '/testlogs';

function getMachines ( slaves ) {
	let machines = [];

	_.forEach( slaves, function ( slave, key ) {
		_.forEach( slave, function ( machine, machineKey ) {
			let m = {
				'id'       : machine.id,
				'platform' : machine.platform
			};
			machines.push( m );
		} );
	} );

	return machines;
}

function createWriteStream( session ) {
	let writeStream = fs.createWriteStream( logPath + '/' + session + '.log', { 'flags' : 'w' } );
	writeStream.on( 'error', function ( error ) {
		// error
	} );
	return writeStream;
}

// FIREHOSE
master.on( 'data', function ( data ) {
	_.forEach( io.sockets.connected, ( socket, socketId ) => {
		socket.emit( 'data-stream', data );
	} );
} );

// When there are new or removed slaves
master.on( 'update-slaves-list', function ( slaves ) {
	_.forEach( io.sockets.connected, ( socket, socketId ) => {
		let machines = getMachines( slaves );
		socket.emit( 'update-slaves-list', machines );
	} );
} );

io.sockets.on( 'connection', ( socket ) => {

	// Initially send for available machines
	socket.on( 'update-slaves-list', () => {
		let machines = getMachines( master.slaves );
		socket.emit( 'update-slaves-list', machines );
	} );

	socket.on( 'register-browserstack', ( data ) => {
		socket.join( 'browserstack-slave' );
		var browserstack = JSON.parse( data.browserstack );
		var machine = _.findWhere( protractorConfig.multiCapabilities, {
			'browserName' : browserstack.automation_session.browser,
			'os'          : browserstack.automation_session.os,
			'os_version'  : browserstack.automation_session.os_version
		} );
		socket.browserstackMachineId = machine.id;
		socket.session               = data.session;

		// create write stream
		socket.writeStream = createWriteStream( socket.session );
	} );
	// Check what happened here
	socket.on( 'browserstack-stream', ( data ) => {
		_.forEach( io.sockets.connected, ( socketEach, socketId ) => {
			socket.writeStream.write( data.data[ 0 ] );
			socketEach.emit( 'browserstack-data-stream', {
				'machineId' : socket.browserstackMachineId,
				'data'      : data.data[ 0 ]
			} );
		} );
	} );

} );

server.register( require( 'inert' ), ( error ) => {

	staticFiles.route( {
		'method' : 'GET',
		'path' : '/{param*}',
		'handler' : {
			'directory' : {
				'path' : 'public'
			}
		}
	} );

	server.start( ( error ) => {
		console.log( 'started' );
	} );

} );
