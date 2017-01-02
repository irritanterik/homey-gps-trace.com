/* global Homey */
var Util = require('../util.js')
var Geofences = require('../geofences.js')

exports.init = function () {
  Homey.manager('flow').on('trigger.tracker_geofence_entered', onTriggerTrackerGeofence)
  Homey.manager('flow').on('trigger.tracker_geofence_entered.geofence.autocomplete', onTriggerTrackerGeofenceGeofenceAutocomplete)
  Homey.manager('flow').on('trigger.tracker_geofence_left', onTriggerTrackerGeofence)
  Homey.manager('flow').on('trigger.tracker_geofence_left.geofence.autocomplete', onTriggerTrackerGeofenceGeofenceAutocomplete)
}

function onTriggerTrackerGeofence (callback, args, state) {
  Util.debugLog('flow trigger tracker geofence evaluation', {card: args.geofence.geofenceId.toString(), state: state.geofence.toString()})
  callback(null, args.geofence.geofenceId.toString() === state.geofence.toString())
}

function onTriggerTrackerGeofenceGeofenceAutocomplete (callback, args) {
  callback(null, Geofences.geofencesFilteredList(args.query))
}
