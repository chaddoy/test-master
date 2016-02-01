'use strict';
var host   = 'localhost';
var socket = io( 'ws://' + host + ':3401' );

var SlaveTabs = React.createClass( {
	'_handleClick' : function ( e ) {
		this.props.onSwitchTab( e.currentTarget.dataset.index, this.props.slaves[ e.currentTarget.dataset.index ] );
	},

	'render' : function () {
		var navbarStyle = {
			'clear' : 'both'
		};

		return (
			<div className="navbar" style={ navbarStyle }>
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

				<hr />
			</div>
		);
	}

} );

var MasterSlaveApp = React.createClass( {

	'getInitialState' : function () {
		return {
			'users'       : [ ],
			'data'        : [ ],
			'dataSelect'  : [ ],
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
		localStorage.caseCount = 0;

		socket.on( 'connect', this._initialize );
		socket.on( 'data-stream', this._streamData );
		socket.on( 'disconnect', this._disconnect );
		socket.on( 'update-slaves-list', this._updateSlaveList );
		socket.on( 'testcase-end', this._onTestCaseEnd );

		$.get( 'http://' + host + ':3400/test-cases', function( result ) {
			if ( this.isMounted() ) {
				this.setState( {
					data : result
				} );

				// these are all for UI not to hang
				var endCount   = 500;
				var interval   = 500;
				var timeout = setInterval( function () {
					var clear = 0;
					if ( endCount >= result.length ) {
						clearTimeout( timeout );
						clear = 1;
						console.log( 'done options' );
					}
					this.setState( {
						dataSelect : result.slice( 0, endCount )
					} );
					endCount += interval;
				}.bind( this ), 1000 );
			}
		}.bind( this ) );
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

	'getUsers' : function ( textarea ) {
		var textAreaValue = textarea.value.replace( '[', '' ).replace( ']', '' ).split( '},' );
		var users         = [ ];

		textAreaValue.map( function ( value ) {
			users.push( JSON.parse( value.replace( '}', '' ) + '}' ) );
		} );

		return users;
	},

	'getRandomUser' : function ( textarea ) {
		var randomKey = Math.floor(Math.random() * this.getUsers( textarea ).length ) + 1;
		return this.getUsers( textarea )[ randomKey - 1 ];
	},

	'getSlaveData' : function ( slaveName ) {
		return this.state.slaves.filter( ( slave ) => {
			return slave.name === slaveName;
		} )[ 0 ];
	},

	'caseLimit'    : 1,
	'currentUser'  : { },
	'arrayPromise' : [ ],

	'popArrayPromise' : function () {
		if ( this.arrayPromise.length > 0 ) {
			var promise = this.arrayPromise.pop();

			promise().then( function () {
				this.popArrayPromise();
			}.bind( this ) );
		}
	},

	'pushArrayPromise' : function ( slave, testCase, user ) {
		this.arrayPromise.push( function () {
			return new Promise( function ( resolve, reject) {
				$.get( 'http://' + host + ':3400/vms/' + slave.platform + '/' + slave.id + '/' + testCase + '?username=' + user.username + '&password=' + user.password + '&firstname=' + user.firstname + '&school=' + user.school, function () {
					console.log( 'sucess' );
					resolve();
				} );
			} );
		} );
	},

	'requestByBatch' : function ( slave, user, testCases, limit ) {
		for ( var i = 0; i < limit; i++ ) {
			localStorage.caseCount++;
			this.pushArrayPromise( slave, testCases[ localStorage.caseCount - 1 ].filename, user );
		}
	},

	'_onTestCaseEnd' : function ( data ) {
		this.requestByBatch( this.getSlaveData( data.name ), this.currentUser, this.state.data, this.caseLimit );
		this.popArrayPromise();
	},

	'resetCaseCount' : function () {
		localStorage.caseCount = 0;
	},

	'run' : function ( e ) {
		let textarea = e.target.parentNode.getElementsByTagName( 'textarea' )[ 0 ];

		if ( textarea.value && this.state.data.length && this.state.slaves.length ) {
			this.currentUser = this.getRandomUser( textarea );

			this.state.slaves.map( ( slave ) => {
				this.requestByBatch( slave, this.currentUser, this.state.data, this.caseLimit );
			} );

			this.popArrayPromise();
		}
	},

	'runOne' : function ( e ) {
		let textarea  = e.target.parentNode.getElementsByTagName( 'textarea' )[ 0 ];
		let select    = e.target.parentNode.getElementsByTagName( 'select' )[ 0 ];
		let selected  = select.options[ select.selectedIndex ].value;

		if ( textarea.value && this.state.data.length && this.state.slaves.length ) {
			this.currentUser = this.getRandomUser( textarea );

			this.state.slaves.map( ( slave ) => {
				this.pushArrayPromise( slave, selected, this.currentUser );
			} );

			this.popArrayPromise();
		}
	},

	'render' : function () {
		return (
			<div>
				<hr />

				<div className="col-xs-12">
					<h3>Format:</h3>
					<code>
						&#91;
						&#123;
							"username": "USERNAME",
							"password": "PASSWORD",
							"firstname": "FIRSTNAME",
							"school": "school"
						&#125;
						&#93;
					</code>
					<br />
					<br />
				</div>

				<div className="col-xs-12">
					<textarea rows="8" cols="60"></textarea>
					<br />
					<button type="button" className="btn btn-primary" onClick={ this.runOne }>Run</button>
					&nbsp;&nbsp;&nbsp;
					<select>
						{
							this.state.dataSelect.map( function ( file ) {
								return (
									<option value={ file.filename }>{ file.filename }</option>
								);
							}.bind( this ) )
						}
					</select>
					&nbsp;&nbsp;&nbsp;
					<button type="button" className="btn btn-primary" onClick={ this.run }>Run All</button>
					&nbsp;&nbsp;
					<button type="button" className="btn btn-danger" onClick={ this.resetCaseCount }>Reset</button>
					<br />
					<br />
				</div>

				<SlaveTabs slaves={ this.state.slaves } onSwitchTab={ this._setActiveTab } />
				<StdoutContainer slave={ this.state.activeSlave } />
			</div>
		);
	}

} );

ReactDOM.render(
	<MasterSlaveApp />,
	document.getElementById( 'app' )
);
