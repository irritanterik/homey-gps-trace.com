/* global Homey */
var Util = require('../util.js')
var Geofences = require('../geofences.js')

exports.init = function () {
  Homey.manager('flow').on('condition.tracker_geofence', onConditionTrackerGeofence)
  Homey.manager('flow').on('condition.tracker_geofence.geofence.autocomplete', onConditionTrackerGeofenceGeofenceAutocomplete)
  Homey.manager('flow').on('condition.tracker_moving', onConditionTrackerMoving)
}

function onConditionTrackerGeofence (callback, args) {
  Util.debugLog('Flow condition tracker_geofence', args)
  callback(null, Homey.manager('drivers').getDriver('tracker').getTrackers()[args.device.id].geofences.indexOf(args.geofence.geofenceId) !== -1)
}

function onConditionTrackerGeofenceGeofenceAutocomplete (callback, args) {
  callback(null, Geofences.geofencesFilteredList(args.query))
}

function onConditionTrackerMoving (callback, args) {
  Util.debugLog('Flow condition tracker_moving', args)
  callback(null, Homey.manager('drivers').getDriver('tracker').getTrackers()[args.device.id].moving === true)
}
