'use strict';

const net          = require( 'net' );
const uuid         = require( 'uuid' );
const EventEmitter = require( 'events' );
const util         = require( 'util' );
const _            = require( 'lodash' );

const testProtocol   = require( 'test-protocol' );
const read           = testProtocol.read;
const transformWrite = testProtocol.write;

function debug () {
	console.log.apply( null, Array.prototype.slice.call( arguments ) );
}

function Master ( options ) {

	EventEmitter.call( this );

	this.defaultConfig = {
		'port' : 7777
	};

	this.slaves = {};

	options = options || this.defaultConfig;

	this.server = net.createServer( ( socket ) => {

		socket.on( 'connected', function () {
			debug( 'Hello' );
		} );

		socket.on( 'data', ( data ) => {

			let commands = read( data );

			for( let i = 0; i < commands.length; ++i ) {

				let command = commands[ i ][ 0 ];
				if( command === 'REPLY' ) {
					var cb = socket.queue.shift();
					cb( null, {
						'machine' : socket.id,
						'result'  : commands[ i ]
					} );
				} else if( command === 'FIREHOSE' ) {
					this[ command ]( socket, commands[ i ] );
				} else {
					// There should be reconnect of packet if there is data loss
					if( this[ command ] ) {
						this[ command ]( socket, commands[ i ] );
					} else {
						debug( 'Corrupted data' );
						debug( commands[ i ] );
					}
				}

			}
		} );

		socket.on( 'close', () => {
			delete this.slaves[ socket.platform ][ socket.id ];
			this.emit( 'update-slaves-list', this.slaves );
		} );

		socket.on( 'end', function () {
			debug( 'Ended connection' );
		} );
	} );

	this.server.listen( options.port, () => {
		this.emit( 'listening', this );
	} );

}

util.inherits( Master, EventEmitter );

Master.prototype.IAM = function ( socket, meta ) {

	let slaveMeta   = JSON.parse( meta[ 1 ] );
	let platform    = slaveMeta.platform;

	socket.id       = slaveMeta.id;
	socket.platform = slaveMeta.platform;

	if( !this.slaves[ platform ] ) {
		this.slaves[ platform ] = {};
	}

	this.slaves[ platform ][ socket.id ] = socket;

	// For individual socket queues
	this.slaves[ platform ][ socket.id ].queue = [];

	// Reply for good
	socket.write( transformWrite.apply( null, [ 'REPLY', 'HI', socket.id ] ) );

	// Update slaves list
	this.emit( 'update-slaves-list', this.slaves );
};

// This would be hosed to socket IO
Master.prototype.FIREHOSE = function ( socket, data ) {
	this.emit( 'data', {
		'platform' : socket.platform,
		'machine'  : socket.id,
		'data'     : data
	} );
};

Master.prototype.exec = function ( targetMachine, commandObject, cb ) {
	// Check machine if existing
	if( !this.slaves ||
			!this.slaves[ targetMachine.platform ] ||
			!this.slaves[ targetMachine.platform ][ targetMachine.machine ] ) {
		return cb( new Error( 'Non existing machine' ) );
	}

	let command = JSON.stringify( commandObject );
	let machine = this.slaves[ targetMachine.platform ][ targetMachine.machine ];
	machine.write( transformWrite( 'RUN', command ) );
	machine.queue.push( cb );
};

module.exports = Master;
