'use strict';
var socket  = io( 'ws://localhost:3401' );

var SlaveTabs = React.createClass( {
	'_handleClick' : function ( e ) {
		this.props.onSwitchTab( e.currentTarget.dataset.index, this.props.slaves[ e.currentTarget.dataset.index ] );
	},

	'render' : function () {

		return (
			<div className="navbar">
				<ul className="nav nav-tabs">
					{
						this.props.slaves.map( function ( slave, key ) {
							return (
								<li key={ key } role="presentation" className={ slave.activeTab ? 'active' : '' }>
									<a href="#" data-index={ key } onClick={ this._handleClick }>
									{ slave.name }
									</a>
								</li>
							);
						}.bind( this ) )
					}
				</ul>
			</div>
		);
	}

} );

var SlaveContainer = React.createClass( {

	'getInitialState': function() {
			return {
				'data' : [ 's' ]
			};
	},

	'componentDidMount' : function () {
		$.get( 'http://localhost:3400/test-cases', function( result ) {
			if ( this.isMounted() ) {
				this.setState( {
					data : result
				} );
			}
		}.bind( this ) );
	},

	'_handleClick' : function ( e ) {
		let select   = e.target.parentNode.getElementsByTagName( 'select' )[ 0 ];
		let selected = select.options[ select.selectedIndex ].value;
		let username = e.target.parentNode.getElementsByTagName( 'input' )[ 0 ].value;
		let password = e.target.parentNode.getElementsByTagName( 'input' )[ 1 ].value;

		$.get( 'http://localhost:3400/vms/' + this.props.slave.platform + '/' + this.props.slave.id + '/' + selected + '?username=' + username + '&password=' + password, function () {
			console.log( 'sucess' );
		} );
	},

	'popArrayPromise' : function () {
		if ( this.arrayPromise.length > 0 ) {
			var promise = this.arrayPromise.pop();

			promise().then( function () {
				this.popArrayPromise();
			}.bind( this ) );
		}
	},

	'pushArrayPromise' : function ( slavePlatform, slaveId, optValue, username, password ) {
		this.arrayPromise.push( function () {
			return new Promise( function ( resolve, reject) {
				$.get( 'http://localhost:3400/vms/' + slavePlatform + '/' + slaveId + '/' + optValue + '?username=' + username + '&password=' + password, function () {
					console.log( 'sucess' );
					resolve();
				} );
			} );
		} );
	},

	'_runAll' : function ( e ) {
		let select        = e.target.parentNode.getElementsByTagName( 'select' )[ 0 ];
		let username      = e.target.parentNode.getElementsByTagName( 'input' )[ 0 ].value;
		let password      = e.target.parentNode.getElementsByTagName( 'input' )[ 1 ].value;
		let slavePlatform = this.props.slave.platform;
		let slaveId       = this.props.slave.id;
		let optionValue;
		this.arrayPromise = [];

		for ( var i = 0; i < select.length; i++ ) {
			optionValue = select.options[i].value;
			this.pushArrayPromise( slavePlatform, slaveId, optionValue, username, password );
		};

		this.popArrayPromise( this.arrayPromise );

	},

	'render' : function () {
		return (
			<div className="col-xs-12">
				<h3>{ this.props.slave.name }</h3>
				<input type="text" className="form-control" placeholder="Username" />
				<input type="text" className="form-control" placeholder="Password" />
				<button type="button" className="btn btn-primary" onClick={ this._runAll }>Run All</button>
				<button type="button" className="btn btn-primary" onClick={ this._handleClick }>Run</button>
				<select>
				{
					this.state.data.map( function ( file ) {
						return (
							<option value={ file.filename }>{ file.filename }</option>
						);
					}.bind( this ) )
				}
				</select>
				<button type="button" className="btn btn-danger">Cancel</button>
			</div>
		);
	}

} );

var StdoutContainer = React.createClass( {

	'render' : function () {
		return (
			<div className="stdout col-xs-12">
				{
					this.props.slave.stdout.map( function ( stdout, key ) {
						// identify if stdout contains an accepted HTML tag
						if ( stdout.indexOf( '\'<a href=' ) > -1 ) {
							// take out error message prefix - token[ 0 ]
							var token   = stdout.split( '\'<a href="' );
							// take redirect url - url[ 0 ]
							var url     = token[ 1 ].split( '" target="false">' );
							// take out anchor text - message[ 0 ]
							var message = url[ 1 ].split( '</a>' );
							// explicitly create the anchor inside react
							return (
								<p key={ key }>{ token[ 0 ] }<a href={ url[ 0 ] } target="false">{ message[ 0 ] }</a></p>
							);
						// continue usual render when there are no anchors
						} else {
							return (
								<p key={ key }>{ stdout }</p>
							);
						}
					} )
				}
			</div>
		);
	}

} );

var MasterSlaveApp = React.createClass( {

	'getInitialState' : function () {
		return {
			'slaves'      : [ ],
			'activeSlave' : {
				'id'        : '',
				'platform'  : '',
				'activeTab' : false,
				'stdout'    : [ ]
			}
		};
	},

	'componentDidMount' : function () {
		socket.on( 'connect', this._initialize );
		socket.on( 'data-stream', this._streamData );
		socket.on( 'disconnect', this._disconnect );
		socket.on( 'update-slaves-list', this._updateSlaveList );
	},

	'_initialize' : function () {
		socket.emit( 'update-slaves-list', function ( data ) {
			console.log( data );
		} );
	},

	'_streamData' : function ( res ) {
		this.state.slaves.filter( function ( slave ) {
			if ( slave.platform === res.platform && slave.id === res.machine ) {
				slave.stdout.push( res.data[ 2 ] );
			}
		} );

		this.setState( { 'slaves' : this.state.slaves } );
	},

	'_disconnect' : function ( data ) {
		console.log( data );
	},

	'_updateSlaveList' : function ( slaves ) {
		slaves.map( function ( slave, key ) {
			slave.activeTab = key === 0;
			slave.stdout    = [ ];

			if ( key === 0 ) {
				this.setState( { 'activeSlave' : slave } );
			}
		}.bind( this ) );

		this.setState( { 'slaves' : slaves } );
	},

	'_setActiveTab' : function ( index, activeSlave ) {
		this.state.slaves.map( function ( slave, key ) {
			slave.activeTab = key === parseInt( index, 10 );
		} );

		this.setState( { 'slaves' : this.state.slaves } );
		this.setState( { 'activeSlave' : activeSlave } );
	},

	'render' : function () {
		return (
			<div>
				<SlaveTabs slaves={ this.state.slaves } onSwitchTab={ this._setActiveTab } />
				<SlaveContainer slave={ this.state.activeSlave } />
				<StdoutContainer slave={ this.state.activeSlave } />
			</div>
		);
	}

} );

ReactDOM.render(
	<MasterSlaveApp />,
	document.getElementById( 'app' )
);
