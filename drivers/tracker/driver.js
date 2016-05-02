/* global Homey */
'use strict'

var Location = require('../../lib/location.js')
var Util = require('../../lib/util.js')
var Inside = require('point-in-polygon')
var retryTrackingTimeoutId = null
var tracking = null
var trackers = {}
var trackerTimeoutObjects = {}
var geofences = {}
var debugSetting = true
var debugLog = []
// var exampleTrackerObject['x123'] = {
//   trackerId: 'x123',
//   name: 'Tesla S'
//   location: {
//     place: 'Dam',
//     city: 'Amsterdam',
//     lat: 4.8904221,
//     lng: 52.3731141
//   }
//   geofences [1460492122638, 1460492122639],
//   timeLastUpdate: 1460492122638,
//   timeLastTrigger: 1460492122638,
//   moving: true,
//   route: {
//     distance: 13,
//     start: {
//       time: 1460492122638,
//       place: 'Dam',
//       city: 'Amsterdam',
//       lng: 52.3731141,
//       lat: 4.8904221
//     },
//     end: {
//       place: 'Plein',
//       city: 'Den Haag',
//       lng: 52.3731141,
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

  // Push new event, remove items over 100 and save new array
  Homey.manager('api').realtime('gpsLog', {datetime: new Date(), message: message, data: data})
  debugLog.push({datetime: new Date(), message: message, data: data})
  if (debugLog.length > 100) debugLog.splice(0, 1)
  if (data == null) {
    Homey.log(Util.epochToTimeFormatter(), message)
  } else {
    Homey.log(Util.epochToTimeFormatter(), message, data)
  }
  Homey.manager('settings').set('gpsLog', debugLog)
} // function GpsDebugLog

function checkGeofences (notrigger) {
  if (!trackers) return
  Object.keys(trackers).forEach(function (trackerId) {
    checkGeofencesForTracker(trackerId, notrigger)
  })
}

function checkGeofencesForTracker (trackerId, notrigger) {
  if (!geofences) return
  Object.keys(geofences).forEach(function (geofenceId) {
    var trackerInGeofence = false
    var trackerWasInGeofence = trackers[trackerId].geofences.indexOf(geofenceId) !== -1
    if (geofences[geofenceId].type === 'CIRCLE') {
      var distance = Util.calculateDistance(
        trackers[trackerId].location.lat,
        trackers[trackerId].location.lng,
        geofences[geofenceId].circle.center.lat,
        geofences[geofenceId].circle.center.lng,
        'M'
      )
      trackerInGeofence = distance < geofences[geofenceId].circle.radius
    } else {
      var trackerPositionShort = [trackers[trackerId].location.lat, trackers[trackerId].location.lng]
      var geofencePathShort = []
      if (geofences[geofenceId].type === 'POLYGON') {
        geofences[geofenceId].polygon.path.forEach(function (point) {
          geofencePathShort.push([point.lat, point.lng])
        })
      } else {
        geofences[geofenceId].rectangle.path.forEach(function (point) {
          geofencePathShort.push([point.lat, point.lng])
        })
      }
      trackerInGeofence = Inside(trackerPositionShort, geofencePathShort)
    }
    if ((trackerInGeofence) && (!trackerWasInGeofence)) {
      trackers[trackerId].geofences.push(geofenceId)
      if (!notrigger) {
        Homey.manager('flow').triggerDevice(
          'tracker_geofence_entered',
          null, // notokens
          {geofence: geofenceId},
          {id: trackerId},
          function (err, result) {
            GpsDebugLog('flow trigger tracker_geofence_entered ', {id: trackerId, geofenceId: geofenceId, error: err, result: result})
          }
        )
      }
    }
    if ((!trackerInGeofence) && (trackerWasInGeofence)) {
      trackers[trackerId].geofences.splice(trackers[trackerId].geofences.indexOf(geofenceId), 1)
      if (!notrigger) {
        Homey.manager('flow').triggerDevice(
          'tracker_geofence_left',
          null, // notokens
          {geofence: geofenceId},
          {id: trackerId},
          function (err, result) {
            GpsDebugLog('flow trigger tracker_geofence_left ', {id: trackerId, geofenceId: geofenceId, error: err, result: result})
          }
        )
      }
    }
  })
}

function stopMoving (trackerId) {
  GpsDebugLog('stopMoving called', {trackerId: trackerId, moving: trackers[trackerId].moving})
  trackerTimeoutObjects[trackerId] = null
  if (!trackers[trackerId].moving) return
  if (!trackers[trackerId].route) return

  // create route object for persistancy
  var route = trackers[trackerId].route
  route.end = trackers[trackerId].location
  route.end.time = trackers[trackerId].timeLastUpdate
  route.trackerId = trackerId

  var allRoutes = Homey.manager('settings').get('gpsRoutes') || []
  allRoutes.push(route)
  Homey.manager('settings').set('gpsRoutes', allRoutes)

  // TODO: Read setting and route object to collection for geofence analysis
  // update tracker
  trackers[trackerId].moving = false
  delete trackers[trackerId].route
  Homey.manager('api').realtime('gpsLocation', trackers[trackerId])

  // handle flows
  var tracker_tokens = {
    start_location: Util.createAddressSpeech(route.start.place, route.start.city),
    stop_location: Util.createAddressSpeech(route.end.place, route.end.city),
    distance: Math.ceil(route.distance) || 0
  }

  Homey.manager('flow').triggerDevice(
    'tracker_stopt_moving',
    tracker_tokens,
    null,
    {id: trackerId},
    function (err, result) {
      GpsDebugLog('flow trigger tracker_stopt_moving ', {id: trackerId, error: err, result: result})
    }
  )
}

function initiateTracking () {
  if (retryTrackingTimeoutId) clearTimeout(retryTrackingTimeoutId)
  debugLog = Homey.manager('settings').get('gpsLog')
  debugSetting = true
  retryTrackingTimeoutId = null

  GpsDebugLog('######### GPS TRACKING ## initiateTracking #########################')
  if (tracking) tracking.stopTracking()
  tracking = null

  geofences = Homey.manager('settings').get('geofences')
  var settings = Homey.manager('settings').get('gpsaccount')
  if (!settings) return GpsDebugLog('  no settings!')
  if (!settings.debug) debugSetting = false
  if (!Object.keys(trackers).length) return GpsDebugLog('  no devices to track!')
  if (!settings.polling) return GpsDebugLog('  polling disabled in settings')

  Object.keys(trackers).forEach(function (trackerId) {
    trackers[trackerId].timeLastTrigger = 0
    // clear route tracking if tracker is not moving or never initiated before
    if (trackers[trackerId].moving !== true) {
      trackers[trackerId].moving = null // picked on location event
      if (trackerTimeoutObjects[trackerId]) {
        clearTimeout(trackerTimeoutObjects[trackerId])
        trackerTimeoutObjects[trackerId] = null
        delete trackers[trackerId].route
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
  tracking.on('tracking_terminated', function (reason) {
    if (tracking) {
      GpsDebugLog('event: tracking_terminated, will retry in 10 minutes.', reason)
      tracking = null
      if (!retryTrackingTimeoutId) {
        retryTrackingTimeoutId = setTimeout(initiateTracking, 10 * 60 * 1000)
      }
    }
  })
  tracking.on('message', function (trackerId, data) {
    GpsDebugLog('event: message', {id: trackerId, distance: data.distance})
  })
  tracking.on('location', function (trackerId, data) {
    var previousLocation = trackers[trackerId].location
    var place = data.address.cycleway || data.address.road || data.address.retail || data.address.footway || data.address.address29 || data.address.path || data.address.pedestrian
    var city = data.address.city || data.address.town || data.address.village
    var wasMoving = trackers[trackerId].moving
    GpsDebugLog('event: location', {id: trackerId, place: place, city: city, distance: data.distance, wasMoving: wasMoving})
    if (place == null || city == null) { GpsDebugLog('no address translation found', data.address) }

    trackers[trackerId].location = {
      place: place,
      city: city,
      lat: data.y,
      lng: data.x
    }
    trackers[trackerId].timeLastUpdate = data.t * 1000

    var timeConstraint = (trackers[trackerId].timeLastUpdate - trackers[trackerId].timeLastTrigger) < (trackers[trackerId].settings.retriggerRestrictTime * 1000)
    var distanceConstraint = data.distance < trackers[trackerId].settings.retriggerRestrictDistance

    // ignore initial location on (re)initiation
    if (wasMoving == null) {
      trackers[trackerId].moving = false
      checkGeofencesForTracker(trackerId, true)
      return
    }

    // postpone stopmoving trigger
    trackers[trackerId].moving = true
    Homey.manager('api').realtime('gpsLocation', trackers[trackerId])

    if (trackerTimeoutObjects[trackerId]) clearTimeout(trackerTimeoutObjects[trackerId])
    trackerTimeoutObjects[trackerId] = setTimeout(
      stopMoving,
      trackers[trackerId].settings.stoppedMovingTimeout * 1000,
      trackerId
    )

    // handle flows
    checkGeofencesForTracker(trackerId)
    if (wasMoving) {
      if (!trackers[trackerId].route) {
        GpsDebugLog('tracker was moving, but without route object', {id: trackerId, tracker: trackers[trackerId]})
        trackers[trackerId].route = {
          distance: data.distance,
          start: previousLocation
        }
      } else {
        trackers[trackerId].route.distance += data.distance
      }
    }

    if (!wasMoving && !distanceConstraint) {
      trackers[trackerId].route = {
        distance: data.distance,
        start: previousLocation
      }
      trackers[trackerId].route.start.time = data.t * 1000
      Homey.manager('flow').triggerDevice(
        'tracker_start_moving',
        {
          address: Util.createAddressSpeech(previousLocation.place, previousLocation.city),
          distance: Math.ceil(data.distance) || 0
        },
        null,
        {id: trackerId},
        function (err, result) {
          GpsDebugLog('flow trigger tracker_start_moving ', {id: trackerId, error: err, result: result})
        }
      )
    }

    if (!timeConstraint && !distanceConstraint) {
      trackers[trackerId].timeLastTrigger = data.t * 1000
      Homey.manager('flow').triggerDevice(
        'tracker_moved',
        {
          address: Util.createAddressSpeech(place, city),
          distance: Math.ceil(data.distance) || 0
        },
        null,
        {id: trackerId},
        function (err, result) {
          GpsDebugLog('flow trigger tracker_moved ', {id: trackerId, error: err, result: result})
        }
      )
    }
  })
  tracking.startTracking(Object.keys(trackers))
} // function initiateTracking

var self = {
  init: function (devices_data, callback) {
    // initial load of trackers object
    devices_data.forEach(function (device_data) {
      trackers[device_data.id] = {
        trackerId: device_data.id,
        name: device_data.id,
        location: {},
        geofences: []
      }
      trackerTimeoutObjects[device_data.id] = null
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

    function geofencesFilteredList (value) {
      var result = []
      Object.keys(geofences).forEach(function (geofenceId) {
        if (geofences[geofenceId].name.toUpperCase().indexOf(value.toUpperCase()) > -1) {
          result.push({name: geofences[geofenceId].name, geofenceId: geofenceId})
        }
      })
      return result
    }

    Homey.manager('flow').on('condition.tracker_geofence.geofence.autocomplete', function (callback, value) {
      callback(null, geofencesFilteredList(value.query))
    })
    Homey.manager('flow').on('trigger.tracker_geofence_entered.geofence.autocomplete', function (callback, value) {
      callback(null, geofencesFilteredList(value.query))
    })
    Homey.manager('flow').on('trigger.tracker_geofence_left.geofence.autocomplete', function (callback, value) {
      callback(null, geofencesFilteredList(value.query))
    })
    Homey.manager('flow').on('condition.tracker_moving', function (callback, args) {
      GpsDebugLog('Flow condition tracker_moving', args)
      callback(null, trackers[args.device.id].moving === true)
    })
    Homey.manager('flow').on('condition.tracker_geofence', function (callback, args) {
      GpsDebugLog('Flow condition tracker_geofence', args)
      checkGeofencesForTracker(args.device.id, true)
      callback(null, trackers[args.device.id].geofences.indexOf(args.geofence.geofenceId) !== -1)
    })
    Homey.manager('flow').on('action.get_position', function (callback, args) {
      GpsDebugLog('Flow action get_position', args)
      // TODO: force position update for tracker if polling is disabled
      // TODO: do *all* the update and trigger magic here
    })
    Homey.manager('flow').on('trigger.tracker_geofence_entered', function (callback, args, state) {
      GpsDebugLog('flow trigger tracker_geofence_entered evaluation', {card: args.geofence.geofenceId.toString(), state: state.geofence.toString()})
      if (args.geofence.geofenceId.toString() === state.geofence.toString()) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    })
    Homey.manager('flow').on('trigger.tracker_geofence_left', function (callback, args, state) {
      GpsDebugLog('flow trigger tracker_geofence_left evaluation', {card: args.geofence.geofenceId.toString(), state: state.geofence.toString()})
      if (args.geofence.geofenceId.toString() === state.geofence.toString()) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    })
    Homey.manager('flow').on('action.say_address', function (callback, args) {
      GpsDebugLog('Flow action say_address', args)
      var trackerId = args.device.id

      function ready (result) {
        GpsDebugLog('result for speech', result)
        Homey.manager('speech-output').say(result)
        callback(null, true)
      }

      // polling is disabled
      if (tracking == null) {
        var settings = Homey.manager('settings').get('gpsaccount')
        if (!settings) return callback('no settings!')
        if (!trackerId) return callback('no device!')

        var singleTrack = new Location({
          user: settings.user,
          password: settings.password
        })
        singleTrack.getAddressForItem(trackerId, function (address) {
          var place = address.cycleway || address.road || address.retail || address.footway || address.address29 || address.path || address.pedestrian
          var city = address.town || address.city
          ready(Util.createAddressSpeech(place, city))
          // TODO: do *all* the update and trigger magic here
        })
        singleTrack.on('error', function (error) {
          GpsDebugLog('event: error', error)
          if (error) return callback(error)
        })
      } else {
        ready(Util.createAddressSpeech(trackers[trackerId].location.place, trackers[trackerId].location.city))
      }
    })

    Homey.manager('settings').on('set', function (setting) {
      if (setting === 'gpsaccount') {
        initiateTracking()
      }
      if (setting === 'geofences') {
        geofences = Homey.manager('settings').get('geofences')
        checkGeofences()
      }
    })

    // delay initiation becouse getting settings per defice take time
    setTimeout(initiateTracking, 5000)
    callback()
  },
  renamed: function (device, name, callback) {
    GpsDebugLog('rename tracker', [device, name])
    trackers[device.id].name = name
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
            icon: 'icon.svg',
            capabilities: [{
              'id': 'location',
              'type': 'object',
              'title': {
                'en': 'Location',
                'nl': 'Positie'
              },
              'units': {
                'en': 'Lat Lng'
              },
              'desc': {
                'en': 'Location of tracker'
              },
              'getable': true,
              'setable': false
            }, {
              'id': 'moving',
              'type': 'boolean',
              'title': {
                'en': 'Moving',
                'nl': 'Onderweg'
              },
              'desc': {
                'en': 'Is tracker moving',
                'nl': 'Is tracker onderweg'
              },
              'getable': true,
              'setable': false
            }]
          }  // TODO: Let user choose icon
          )
        })
        callback(null, devices)
      })
    })
    socket.on('add_device', function (device, callback) {
      GpsDebugLog('pairing: tracker added', device)
      trackers[device.data.id] = {
        trackerId: device.data.id,
        name: device.name,
        location: {},
        geofences: [],
        settings: {
          retriggerRestrictTime: 1,
          retriggerRestrictDistance: 1,
          stoppedMovingTimeout: 120
        }
      }
      trackerTimeoutObjects[device.data.id] = null
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
    try {
      changedKeysArr.forEach(function (key) {
        trackers[device_data.id].settings[key] = newSettingsObj[key]
      })
      callback(null, true)
    } catch (error) {
      callback(error)
    }
  },
  capabilities: {
    location: {
      get: function (device_data, callback) {
        GpsDebugLog('capabilities > location > get', device_data)
        var location = {
          lng: trackers[device_data.id].location.lng,
          lat: trackers[device_data.id].location.lat
        }
        callback(null, location)
      }
    },
    moving: {
      get: function (device_data, callback) {
        GpsDebugLog('capabilities > moving > get', device_data)
        callback(null, trackers[device_data.id].moving)
      }
    }
  },
  getTrackers: function (callback) {
    callback(trackers)
  }
}

module.exports = self
