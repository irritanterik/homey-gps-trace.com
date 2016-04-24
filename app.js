'use strict'
var Geofences = require('./lib/geofences.js')

var self = module.exports = { // eslint-disable-line
  init: function () {
    Geofences.init()

    Homey.manager('flow').on('trigger.tracker_geofence_entered', function (callback, args, state) {
      if (args.geofence.geofenceId.toString() === state.geofence.toString()) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    })

    Homey.manager('flow').on('trigger.tracker_geofence_left', function (callback, args, state) {
      if (args.geofence.geofenceId.toString() === state.geofence.toString()) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    })
  } // end of module init function
}
