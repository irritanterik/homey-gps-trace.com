/* global Homey */
'use strict'

var Location = require('../../lib/location.js')
var Util = require('../../lib/util.js')
var tracking = null
var trackers = {}
var debugSetting = true
var debugLog = []
// var exampleTrackerObject[x] = {
//   place: 'Dam',
//   city: 'Amsterdam',
//   lon: 52.3731141,
//   lat: 4.8904221,
//   timeLastUpdate: 1460492122638,
//   timeLastTrigger: 1460492122638,
//   sumDistanceLastTrigger: 12313,
//   moving: true,
//   movingTimeoutId: 123,
//   route: {
//     timeStart: 1460492122638,
//     distance: 13,
//     origin: {
//       place: 'Dam',
//       city: 'Amsterdam',
//       lon: 52.3731141,
//       lat: 4.8904221
//     },
//     destination: {
//       place: 'Plein',
//       city: 'Den Haag',
//       lon: 52.3731141,
//       lat: 4.8904221
//     }
//   },
//   settings: {
//     retriggerRestrictDistance: 5,
//     retriggerRestrictTime: 5,
//     stoppedMovingTimeout: 240
//   }
// }

function GpsDebugLog (message, data) {
  if (!debugSetting) return
  if (!debugLog) debugLog = []
  if (!data) data = null

  // Push new event, remove items over 30 and save new array
  debugLog.push({datetime: new Date(), message: message, data: data})
  if (debugLog.length > 30) debugLog.splice(0, 1)
  Homey.manager('settings').set('gpslog', debugLog)
  if (data == null) {
    Homey.log(Util.epochToTimeFormatter(), message)
  } else {
    Homey.log(Util.epochToTimeFormatter(), message, data)
  }
}

// TODO: move to library
function stopMoving (trackerid) {
  if (!trackers[trackerid].moving) return
  // create route object for persistancy
  var route = trackers[trackerid].route
  route.destination = {
    place: trackers[trackerid].place,
    city: trackers[trackerid].city,
    lon: trackers[trackerid].lon,
    lat: trackers[trackerid].lat
  }
  // TODO: Read setting and route object to collection for geofence analysis
  // update tracker
  trackers[trackerid].moving = false
  trackers[trackerid].movingTimeoutId = null
  delete trackers[trackerid].route

  // handle flows
  var tracker_tokens = {
    address: Util.createAddressSpeech(route.destination.place, route.destination.city),
    distance: route.distance
  }

  Homey.manager('flow').triggerDevice(
    'tracker_stopt_moving',
    tracker_tokens,
    null,
    {id: trackerid},
    function (err, result) {
      GpsDebugLog('flow trigger tracker_stopt_moving ', {id: trackerid, error: err, result: result})
    }
  )
}

function initiateTracking () {
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

  Object.keys(trackers).forEach(function (trackerid) {
    trackers[trackerid].timeLastTrigger = 0
    trackers[trackerid].sumDistanceLastTrigger = 0
    // clear route tracking if tracker is not moving or never initiated before
    if (trackers[trackerid].moving !== true) {
      trackers[trackerid].moving = null // picked on location event
      if (trackers[trackerid].movingTimeoutId) {
        clearTimeout(trackers[trackerid].movingTimeoutId)
        trackers[trackerid].movingTimeoutId = null
        delete trackers[trackerid].route
      }
    }
  })

  tracking = new Location({
    user: settings.user,
    password: settings.password,
    intervalMS: 10000 // TODO: read from app setting
  })
  tracking.on('error', function (error) {
    GpsDebugLog('event: error', error)
  })
  tracking.on('message', function (trackerid, data) {
    GpsDebugLog('event: message', {id: trackerid, distance: data.distance})
  })
  tracking.on('location', function (trackerid, data) {
    var place = data.address.cycleway || data.address.road || data.address.retail || data.address.footway || data.address.address29 || data.address.path || data.address.pedestrian
    var city = data.address.town || data.address.city
    var wasMoving = trackers[trackerid].moving
    GpsDebugLog('event: location', {id: trackerid, place: place, city: city, distance: data.distance})
    if (place == null || city == null) { GpsDebugLog('no address translation found', data.address) }

    trackers[trackerid].place = place
    trackers[trackerid].city = city
    trackers[trackerid].lat = data.y
    trackers[trackerid].lon = data.x
    trackers[trackerid].timeLastUpdate = data.t * 1000
    trackers[trackerid].sumDistanceLastTrigger += data.distance

    var timeConstraint = (trackers[trackerid].timeLastUpdate - trackers[trackerid].timeLastTrigger) < (trackers[trackerid].settings.retriggerRestrictTime * 1000)
    var distanceConstraint = trackers[trackerid].sumDistanceLastTrigger < trackers[trackerid].settings.retriggerRestrictDistance

    // ignore initial location on (re)initiation
    if (wasMoving == null) {
      trackers[trackerid].moving = false
      return
    }

    // postpone stopmoving trigger
    trackers[trackerid].moving = true
    if (trackers[trackerid].movingTimeoutId) clearTimeout(trackers[trackerid].movingTimeoutId)
    trackers[trackerid].movingTimeoutId = setTimeout(
      function () { stopMoving(trackerid) },
      trackers[trackerid].settings.stoppedMovingTimeout * 1000
    )

    // handle flows
    var tracker_tokens = {
      address: Util.createAddressSpeech(place, city),
      distance: data.distance
    }

    if (wasMoving) {
      if (!trackers[trackerid].route) {
        trackers[trackerid].route = {}
      }
      trackers[trackerid].route.distance += data.distance
    }

    if (!wasMoving && !distanceConstraint) {
      trackers[trackerid].route = {
        timeStart: data.t * 1000,
        distance: data.distance,
        origin: {
          place: place,
          city: city,
          lat: data.y,
          lon: data.x
        }
      }
      Homey.manager('flow').triggerDevice(
        'tracker_start_moving',
        tracker_tokens,
        null,
        {id: trackerid},
        function (err, result) {
          GpsDebugLog('flow trigger tracker_start_moving ', {id: trackerid, error: err, result: result})
        }
      )
    }

    if (!timeConstraint && !distanceConstraint) {
      trackers[trackerid].timeLastTrigger = data.t * 1000
      trackers[trackerid].sumDistanceLastTrigger = 0
      Homey.manager('flow').triggerDevice(
        'tracker_moved',
        tracker_tokens,
        null,
        {id: trackerid},
        function (err, result) {
          GpsDebugLog('flow trigger tracker_moved ', {id: trackerid, error: err, result: result})
        }
      )
    }
  })
  tracking.startTracking(Object.keys(trackers))
} // End of initiateTracking

var self = {
  init: function (devices_data, callback) {
    // initial load of trackers object
    devices_data.forEach(function (device_data) {
      trackers[device_data.id] = {}
      module.exports.getSettings(device_data, function (err, settings) {
        if (err) GpsDebugLog('Error on loading device settings', {device_data: device_data, error: err})
        var trackersettings = {
          retriggerRestrictTime: settings.retriggerRestrictTime || 1,
          retriggerRestrictDistance: settings.retriggerRestrictDistance || 1,
          stoppedMovingTimeout: settings.stoppedMovingTimeout || 120
        }
        trackers[device_data.id].settings = trackersettings
      })
    })

    Homey.manager('flow').on('condition.tracker_moving', function (callback, args) {
      GpsDebugLog('Flow condition tracker_moving', args)
      callback(null, trackers[args.device.id].moving === true)
    })

    Homey.manager('flow').on('action.get_position', function (callback, args) {
      GpsDebugLog('Flow action get_position', args)
      // TODO: force position update for tracker if polling is disabled
    })

    Homey.manager('flow').on('action.say_address', function (callback, args) {
      GpsDebugLog('Flow action say_address', args)
      var trackerid = args.device.id

      function ready (result) {
        GpsDebugLog('result for speech', result)
        Homey.manager('speech-output').say(result)
        callback(null, true)
      }

      // polling is disabled
      if (tracking == null) {
        var settings = Homey.manager('settings').get('gpsaccount')
        if (!settings) return callback('no settings!')
        if (!trackerid) return callback('no device!')

        var singleTrack = new Location({
          user: settings.user,
          password: settings.password
        })
        singleTrack.getAddressForItem(trackerid, function (address) {
          var place = address.cycleway || address.road || address.retail || address.footway || address.address29 || address.path || address.pedestrian
          var city = address.town || address.city
          trackers[trackerid].place = place
          trackers[trackerid].city = city
          ready(Util.createAddressSpeech(place, city))
        }).on('error', function (error) {
          GpsDebugLog('event: error', error)
          if (error) return callback(error)
        })
      } else {
        ready(Util.createAddressSpeech(trackers[trackerid].place, trackers[trackerid].city))
      }
    })

    Homey.manager('settings').on('set', function (setting) {
      if (setting === 'gpsaccount') {
        initiateTracking()
      }
    })

    // delay initiation becouse getting settings per defice take time
    setTimeout(initiateTracking, 10000)
    callback()
  },
  renamed: function (device, name, callback) {
    GpsDebugLog('rename tracker', [device, name])
    callback()
  },
  deleted: function (device, callback) {
    GpsDebugLog('delete tracker', device)
    delete trackers[device.id]
    initiateTracking()
    callback()
  },
  pair: function (socket) {
    var settings = Homey.manager('settings').get('gpsaccount')
    if (settings) {
      var tracking = new Location({
        user: settings.user,
        password: settings.password
      })
    }
    socket.on('start', function (data, callback) {
      if (!settings) { return callback('errorNoSettings') }
      tracking.validateAccount(function (error, userId) {
        if (error) return callback('errorInvalidSettings')
        callback(null)
      })
    })
    socket.on('list_devices', function (data, callback) {
      var devices = []
      tracking.getItems(function (error, items) {
        if (error) return callback(error)
        items.forEach(function (item) {
          devices.push({
            name: item.nm,
            data: {id: item.id.toString()},
            icon: 'icon.svg'}  // TODO: Let user choose icon
          )
        })
        callback(null, devices)
      })
    })
    socket.on('add_device', function (device, callback) {
      GpsDebugLog('pairing: tracker added', device)
      trackers[device.data.id] = {}
      initiateTracking()
      callback(null)
    })
  },
  settings: function (device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
    GpsDebugLog('settings changed', {device_data: device_data, newSettingsObj: newSettingsObj, changedKeysArr: changedKeysArr})

    // TODO: translate errors
    if (newSettingsObj.retriggerRestrictTime < 0) { return callback('Negative value') }
    if (newSettingsObj.retriggerRestrictDistance < 0) { return callback('Negative value') }
    if (newSettingsObj.stoppedMovingTimeout < 30) { return callback('Timout cannot be smaller than 30 seconds') }

    changedKeysArr.forEach(function (key) {
      trackers[device_data.id].settings[key] = newSettingsObj[key]
    })
    callback(null, true)
  },
  capabilities: {
    position: {
      get: function (device_data, callback) {
        GpsDebugLog('capabilities > position > get', device_data)

        if (typeof callback === 'function') {
          callback(null, 'Kalverstraat in Amsterdam')
        }
      },
      set: function (device_data, state, callback) {
        GpsDebugLog('capabilities > position > set', {device_data: device_data, state: state})
        callback(null, state)
      }
    }
  }
}

module.exports = self
