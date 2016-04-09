'use strict'

var Location = require('../../../location.js')
var tracking = null
var trackers = {}
var debugSetting = true
var debugLog = []

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

// TODO: move to helper
function GpsDebugLog(message, data) {
	if (!debugSetting) return
	if (!debugLog) debugLog = []
	if (!data) data = null

	// Push new event, remove items over 30 and save new array
	debugLog.push({datetime: new Date(), message:message, data:data});
	if (debugLog.length > 30) debugLog.splice(0, 1);
	Homey.manager('settings').set('gpslog', debugLog);
	if (data == null) {
		Homey.log(EpochToTimeFormatter(), message)
	} else {
		Homey.log(EpochToTimeFormatter(), message, data)
	}
}

// TODO: move to library
function initiateTracking() {

	console.log(Homey.manager( 'drivers' ).getDriver('tracker'))

	debugLog = Homey.manager('settings').get('gpslog')
	debugSetting = true

	GpsDebugLog('######### GPS TRACKING ## initiateTracking #########################')
	if (tracking) tracking.stopTracking()
	tracking = null

	var settings = Homey.manager('settings').get('gpsaccount')
	if (!settings) return GpsDebugLog('  no settings!')
	if (!settings.debug) debugSetting = false
	if (!Object.keys(trackers).length) return GpsDebugLog('  no devices to track!')
	if (!settings.polling) return GpsDebugLog('  polling disabled in settings')

	tracking = new Location({
		user: settings.user,
		password: settings.password,
		intervalMS: 10000,
	});

	tracking.on('error', function(error) {
		Homey.error(EpochToTimeFormatter(), 'error: ',  error);
	})
	tracking.on('firstPosition', function(item, position) {
		var place = position.address.cycleway || position.address.road || position.address.retail || position.address.footway || position.address.address29
		var city = position.address.town || position.address.city
		GpsDebugLog('firstPosition', {item: item, place: place, city: city})

		trackers[item].place = place
		trackers[item].city = city

		if (place == null || city == null) {
			GpsDebugLog('no address translation found', position.address)
		}

	})
	tracking.on('newPosition', function(item, position) {
		// var place = first(position.address)
		var place = position.address.cycleway || position.address.road || position.address.retail || position.address.footway || position.address.address29
		var city = position.address.town || position.address.city
		GpsDebugLog('newPosition', {item: item, place: place, city: city})
		if (place == null || city == null) {
			GpsDebugLog('no address translation found', position.address)
		}

		trackers[item].place = place
		trackers[item].city = city
		// self.realtime({id: item}, 'position', place)
		Homey.manager('flow').triggerDevice(
			'tracker_moved',
			{address: (place + ' in ' + city)},
			{state: 'test'},
			{id: item},
			function(err, result) {
				GpsDebugLog('flow triggerDevice tracker_moved ', {item: item, error: err, result: result})
			}
		)
	})
	tracking.on('newMessage', function(item, position) {
		GpsDebugLog('newMessage', {item: item, distance: position.distance})
	})
	tracking.startTracking(Object.keys(trackers))
} // End of initiateTracking

var self = {
	init: function(devices_data, callback) {
		devices_data.forEach(function (device_data) {
			trackers[device_data.id] = {}
		})

		Homey.manager('flow').on('action.get_position', function (callback, args){
			GpsDebugLog('Flow action card "get position" triggered', args)

		})

		Homey.manager('flow').on('action.say_address', function( callback, args ){
			GpsDebugLog('Flow action card "say address" triggered', args)

			function ready(result) {
				GpsDebugLog('result for speech', result)
				Homey.manager('speech-output').say(result);
				callback(null, true)
			}

			// polling is disabled
			if (tracking == null) {
				var settings = Homey.manager('settings').get('gpsaccount')
				if (!settings) return callback('no settings')
			  if (!Object.keys(trackers).length) return callback('no devices to track!')

				var singleTrack = new Location({
					user: settings.user,
					password: settings.password
				}).getAddressForItem(args.device.id, function(error, address) {
					if (error) return callback(error)
					var place = address.cycleway || address.road || address.retail || address.footway || address.address29
					var city = address.town || address.city
					trackers[args.device.id].place = place
					trackers[args.device.id].city = city
					// self.realtime({id: args.device.id}, 'position', place)
					result = trackers[args.device.id].place + __("speech.placeCityConjunction") + trackers[args.device.id].city
					ready(result)
				})
			} else {
				var result = ''
				if (trackers[args.device.id].place && trackers[args.device.id].city) {
					result = trackers[args.device.id].place + __("speech.placeCityConjunction") + trackers[args.device.id].city
				} else if (trackers[args.device.id].city) {
					result = trackers[args.device.id].city
				} else if (trackers[args.device.id].place) {
					result = trackers[args.device.id].place
				} else {
					result = __("speech.positionUnknown")
				}
				ready(result)
			}
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
		GpsDebugLog('rename tracker', [device, name])
		callback()
	},
	deleted: function(device, callback) {
		GpsDebugLog('delete tracker', device)
		delete trackers[device.id]
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
						data: {id: item.id.toString()},
						settings: {},      // TODO: Add default settings
						icon: 'icon.svg'}  // TODO: Let user choose icon
					)
				})
				callback(null, devices)
			})
		})
		socket.on('add_device', function (device, callback ) {
			GpsDebugLog('pairing: tracker added', device)
			trackers[device.data.id] = {}
			initiateTracking()
			callback(null)
		})
	},
	capabilities: {
		position: {
			get: function( device_data, callback ){
				GpsDebugLog('capbilities > position > get', device_data)

				if( typeof callback == 'function' ) {
					callback(null, 'Kalverstraat in Amsterdam')
				}
			},
			set: function( device_data, state, callback ) {
				GpsDebugLog('capbilities > position > set', [device_data, state])
				callback( null, state );
			}
		}
	}
}

module.exports = self
