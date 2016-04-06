'use strict'

var Location = require('../../../location.js')
var tracking = null
var trackers = []

// TODO: move to helper
function UnixEpochToTimeFormatter(epoch) {
	return EpochToTimeFormatter(epoch*1000)
}
// TODO: move to helper
function EpochToTimeFormatter(epoch) {
	if (epoch == null) { epoch = (new Date).getTime()}
	return (new Date(epoch)).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1")
}
// TODO: move to helper
function first(obj) {
  for (var a in obj) return a;
}

// TODO: move to library
function initiateTracking() {
	Homey.log('######### GPS TRACKING ## initiateTracking #########################')
	if (tracking) tracking.stopTracking()
	tracking = null

	var settings = Homey.manager('settings').get('gpsaccount')
	if (!settings) return console.log('  no settings!')
	if (!trackers.length) return console.log('  no devices to track!')
	if (!settings.polling) return console.log('  polling diabled in settings')

	tracking = new Location({
		user: settings.user,
		password: settings.password,
		intervalMS: 10000,
	});

	tracking.on('error', function(error) {
		Homey.error(EpochToTimeFormatter(), 'error: ',  error);
	})
	tracking.on('firstPosition', function(item, position) {
		// var place = first(position.address)
		var place = position.address.cycleway || position.address.road || position.address.retail || position.address.footway || position.address.address29
		var city = position.address.town || position.address.city
		Homey.log(UnixEpochToTimeFormatter(position.t), item, 'firstPosition:',place, city);
		if (place == null || city == null) {
			Homey.log(position.address)
		}

	})
	tracking.on('newPosition', function(item, position) {
		// var place = first(position.address)
		var place = position.address.cycleway || position.address.road || position.address.retail || position.address.footway || position.address.address29
		var city = position.address.town || position.address.city
		Homey.log(UnixEpochToTimeFormatter(position.t), item, 'newPosition:', place, city);
		if (place == null || city == null) {
			Homey.log(position.address)
		}

		Homey.manager("flow").triggerDevice(
			"tracker_moved",
			{address: (place + ' in ' + city)},
			{event: 'test'},
			{id: item},
			function(err, result) {
				Homey.log(' triggerDevice ', err, result)
			}
		)

	})
	tracking.on('newMessage', function(item, position) {
		Homey.log(UnixEpochToTimeFormatter(position.t), item, 'newMessage, distance: ', position.distance)
	})

	tracking.startTracking(trackers)
} // End of initiateTracking

var self = {
	init: function(devices_data, callback) {
		devices_data.forEach(function (device_data) {
			trackers.push(device_data.id)
		})

		Homey.manager('settings').on('set', function(setting){
			if (setting == 'gpsaccount') {
				initiateTracking()
			}
		})
		initiateTracking()
		callback()
	},
	renamed: function(device, name, callback) {
		callback()
	},
	deleted: function(device, callback) {
		var newTrackers = []
		trackers.forEach(function (tracker) {
			if (tracker != device.id) {
				newTrackers.push(tracker)
			}
		})
		trackers = newTrackers
		initiateTracking()
		callback()
	},
	pair: function( socket ) {
		var settings = Homey.manager('settings').get('gpsaccount')
		if (settings) {
			var tracking = new Location({
				user: settings.user,
				password: settings.password
			})
		}
		socket.on('start', function(data, callback) {
			if (!settings) { return callback('errorNoSettings') }
			tracking.validateAccount(function(error, userId){
				if (error) return callback('errorInvalidSettings')
				callback(null)
			})
		});
		socket.on('list_devices', function( data, callback ) {
			var devices = []
			tracking.getItems(function(error, items){
				if (error) return callback(error)
				items.forEach(function(item) {
					devices.push({
						name: item.nm,
						data: {id: item.id},
						icon: 'icon.svg'}  // TODO: Let user choose icon
					)
				})
				callback(null, devices)
			})
		})
		socket.on('add_device', function (data, callback ) {
			trackers.push(data.data.id)
			initiateTracking()
			callback(null)
		})
	},
	capabilities: {
		position: {
			get: function( device_data, callback ){
				Homey.log('  capbilities > position > get', device_data)

				if( typeof callback == 'function' ) {
					callback(null, 'Kalverstraat in Amsterdam')
				}
			},
			set: function( device_data, state, callback ) {
				Homey.log('  capabilities > position > set', device_data, state)

				callback( null, state );
			}
		}
	}
}

module.exports = self
