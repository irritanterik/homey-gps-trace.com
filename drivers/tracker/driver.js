/* global Homey */
'use strict'

var Location = require('../../lib/location.js')
var Util = require('../../lib/util.js')
var Geo = require('../../lib/geofences.js')

var retryTrackingTimeoutId = null
var tracking = null
var trackerTimeoutObjects = {}
var geofences = {}
var trackers = {}

function checkGeofences (notrigger) {
  if (!trackers) return
  Object.keys(trackers).forEach((trackerId) => {
    checkGeofencesForTracker(trackerId, notrigger)
  })
}

function checkGeofencesForTracker (trackerId, notrigger) {
  if (!geofences) return
  var trackerGeofencesPrevious = trackers[trackerId].geofences || []
  var trackerInGeofence = Geo.geofencesLocationMatch(trackers[trackerId].location)
  trackers[trackerId].geofences = trackerInGeofence
  if (notrigger) return

  trackerInGeofence.filter(active => trackerGeofencesPrevious.indexOf(active)).forEach(geofenceId => {
    Homey.manager('flow').triggerDevice('tracker_geofence_entered', null,
      {geofence: geofenceId},
      {id: trackerId},
      function (error, result) {
        Util.debugLog('flow trigger tracker entered geofence', {id: trackerId, geofenceId: geofenceId, error: error, result: result})
      }
    )
  })
  trackerGeofencesPrevious.filter(previous => trackerInGeofence.indexOf(previous)).forEach(geofenceId => {
    Homey.manager('flow').triggerDevice('tracker_geofence_left', null,
      {geofence: geofenceId},
      {id: trackerId},
      function (error, result) {
        Util.debugLog('flow trigger tracker left geofence', {id: trackerId, geofenceId: geofenceId, error: error, result: result})
      }
    )
  })
}

function stopMoving (trackerId) {
  Util.debugLog('stopMoving called', {trackerId: trackerId, moving: trackers[trackerId].moving})
  trackerTimeoutObjects[trackerId] = null
  if (!trackers[trackerId].moving) return
  if (!trackers[trackerId].route) return

  // create route object for persistancy
  var route = trackers[trackerId].route
  route.end = trackers[trackerId].location
  route.end.time = trackers[trackerId].timeLastUpdate
  route.trackerId = trackerId

  // only save route if distance > 1000m
  if ((trackers[trackerId].route.distance || 0) > 1000) {
    // TODO: Read setting if route analysis is allowed
    var allRoutes = Homey.manager('settings').get('gpsRoutes') || []
    allRoutes.push(route)
    Homey.manager('settings').set('gpsRoutes', allRoutes)
  }
  // update tracker
  delete trackers[trackerId].route
  trackers[trackerId].moving = false
  module.exports.realtime({id: trackerId}, 'moving', false)
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
    function (error, result) {
      Util.debugLog('flow trigger tracker_stopt_moving ', {id: trackerId, error: error, result: result})
    }
  )
}

// function updateTracker (trackerId, callback) {
//   Util.debugLog('######### GPS TRACKING ## updateTracker #########################')
//   var settings = Homey.manager('settings').get('gpsaccount')
//   if (!settings) return callback('no settings!')
//   if (!trackerId) return callback('no device!')
//
//   var singleTrack = new Location({
//     user: settings.user,
//     password: settings.password
//   })
//   singleTrack.getAddressForItem(trackerId, function (address) {
//     trackers[trackerId].location = address
//     callback(null, trackerId)
//   })
//   singleTrack.on('error', function (error) {
//     Util.debugLog('event: error', error)
//     if (error) return callback(error)
//   })
// }

function initiateTracking () {
  if (retryTrackingTimeoutId) clearTimeout(retryTrackingTimeoutId)
  retryTrackingTimeoutId = null

  Util.debugLog('######### GPS TRACKING ## initiateTracking #########################', {Homey: Homey.version, App: Homey.manifest.version})
  if (tracking) tracking.stopTracking()
  tracking = null

  geofences = Homey.manager('settings').get('geofences')
  var settings = Homey.manager('settings').get('gpsaccount')
  if (!settings) return Util.debugLog('  no settings!')

  tracking = new Location({
    user: settings.user,
    password: settings.password,
    intervalMS: 10000 // TODO: read from app setting
  })

  if (!Object.keys(trackers).length) return Util.debugLog('  no devices to track!')
  tracking.on('error', error => { Util.debugLog('event: error', error) })

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

  tracking.on('tracking_terminated', function (reason) {
    if (tracking) {
      Util.debugLog('event: tracking_terminated, will retry in 10 minutes.', reason)
      tracking = null
      if (!retryTrackingTimeoutId) {
        retryTrackingTimeoutId = setTimeout(initiateTracking, 10 * 60 * 1000)
      }
    }
  })
  tracking.on('message', function (trackerId, data) {
    Util.debugLog('event: message', {id: trackerId, distance: data.distance})
  })
  tracking.on('location', function (trackerId, data) {
    var previousLocation = trackers[trackerId].location
    var place = data.address.place
    var city = data.address.city
    var wasMoving = trackers[trackerId].moving

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
      Util.debugLog('initial location for tracker', {id: trackerId, place: place, city: city})
      return
    }

    // handle flows
    Util.debugLog('event: location', {id: trackerId, place: place, city: city, distance: data.distance, wasMoving: wasMoving, timeConstraint: timeConstraint, distanceConstraint: distanceConstraint})
    checkGeofencesForTracker(trackerId)
    if (wasMoving) {
      // next if part is temp fix. Should be removed when bug final fixed
      if (!trackers[trackerId].route) {
        Util.debugLog('tracker was moving, but without route object', {id: trackerId, tracker: trackers[trackerId]})
        trackers[trackerId].route = {
          distance: data.distance,
          start: previousLocation
        }
      } else {
        trackers[trackerId].route.distance += data.distance
      }
    }

    if (!wasMoving && !distanceConstraint) {
      trackers[trackerId].moving = true
      trackers[trackerId].route = {
        distance: data.distance,
        start: previousLocation
      }
      trackers[trackerId].route.start.time = data.t * 1000
      module.exports.realtime({id: trackerId}, 'moving', true)
      Homey.manager('flow').triggerDevice(
        'tracker_start_moving',
        {
          address: Util.createAddressSpeech(previousLocation.place, previousLocation.city),
          distance: Math.ceil(data.distance) || 0
        },
        null,
        {id: trackerId},
        function (err, result) {
          Util.debugLog('flow trigger tracker_start_moving ', {id: trackerId, error: err, result: result})
        }
      )
    }

    if (!timeConstraint && !distanceConstraint) {
      trackers[trackerId].timeLastTrigger = data.t * 1000
      module.exports.realtime({id: trackerId}, 'location', JSON.stringify(trackers[trackerId].location))
      module.exports.realtime({id: trackerId}, 'address', place + ', ' + city)

      Homey.manager('flow').triggerDevice(
        'tracker_moved',
        {
          address: Util.createAddressSpeech(place, city),
          distance: (Math.ceil(data.distance) || 0)
        },
        null,
        {id: trackerId},
        function (err, result) {
          Util.debugLog('flow trigger tracker_moved ', {id: trackerId, error: err, result: result})
        }
      )
    }

    // postpone stopmoving trigger
    if (trackers[trackerId].moving) {
      if (trackerTimeoutObjects[trackerId]) clearTimeout(trackerTimeoutObjects[trackerId])
      trackerTimeoutObjects[trackerId] = setTimeout(
        stopMoving,
        trackers[trackerId].settings.stoppedMovingTimeout * 1000,
        trackerId
      )
    }

    Homey.manager('api').realtime('gpsLocation', trackers[trackerId])
  })

  if (!settings.polling) return Util.debugLog('  polling disabled in settings')
  tracking.startTracking(Object.keys(trackers))
} // function initiateTracking

var self = {
  init: function (devices_data, callback) {
    // initial load of trackers object
    devices_data.forEach(function (device_data) {
      Homey.manager('drivers').getDriver('tracker').getName(device_data, function (err, name) {
        if (err) return
        trackers[device_data.id] = {
          trackerId: device_data.id,
          name: name,
          location: {},
          geofences: []
        }
        trackerTimeoutObjects[device_data.id] = null
        module.exports.getSettings(device_data, function (err, settings) {
          if (err) Util.debugLog('Error on loading device settings', {device_data: device_data, error: err})
          var trackersettings = {
            retriggerRestrictTime: settings.retriggerRestrictTime || 10,
            retriggerRestrictDistance: settings.retriggerRestrictDistance || 1,
            stoppedMovingTimeout: settings.stoppedMovingTimeout || 120
          }
          trackers[device_data.id].settings = trackersettings
        })
      })
    })

    Homey.manager('settings').on('set', function (setting) {
      switch (setting) {
        case 'gpsaccount':
          initiateTracking()
          break
        case 'geofences':
          geofences = Homey.manager('settings').get(setting)
          checkGeofences()
          break
      }
    })

    // delay initiation because getting settings per device take time
    setTimeout(initiateTracking, 2000)
    setTimeout(callback, 6000)
  },
  renamed: function (device, name, callback) {
    Util.debugLog('rename tracker', [device, name])
    trackers[device.id].name = name
    callback()
  },
  deleted: function (device) {
    Util.debugLog('delete tracker', device)
    delete trackers[device.id]
    initiateTracking()
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
            icon: 'icon.svg'
          }  // TODO: Let user choose icon
          )
        })
        callback(null, devices)
      })
    })
    socket.on('add_device', function (device, callback) {
      Util.debugLog('pairing: tracker added', device)
      trackers[device.data.id] = {
        trackerId: device.data.id,
        name: device.name,
        location: {},
        geofences: [],
        settings: {
          retriggerRestrictTime: 10,
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
    Util.debugLog('settings changed', {device_data: device_data, newSettingsObj: newSettingsObj, changedKeysArr: changedKeysArr})
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
        Util.debugLog('capabilities > location > get', device_data)
        if (!trackers[device_data.id] || !trackers[device_data.id].location) return callback('not_ready')
        callback(null, JSON.stringify(trackers[device_data.id].location))
      }
    },
    address: {
      get: function (device_data, callback) {
        Util.debugLog('capabilities > address > get', device_data)
        if (!trackers[device_data.id] || !trackers[device_data.id].location) return callback('not_ready')
        callback(null, trackers[device_data.id].location.place + ', ' + trackers[device_data.id].location.city)
      }
    },
    moving: {
      get: function (device_data, callback) {
        Util.debugLog('capabilities > moving > get', device_data)
        if (!trackers[device_data.id]) return callback('not_ready')
        callback(null, trackers[device_data.id].moving || false)
      }
    }
  },
  getTrackers: () => { return trackers }
}

module.exports = self
