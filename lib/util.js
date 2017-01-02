/* global __ */

exports.calculateDistance = function (lat1, lon1, lat2, lon2, unit) {
  // based on https://www.geodatasource.com/developers/javascript
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0
  unit = unit.toUpperCase() || 'M'
  var radlat1 = Math.PI * lat1 / 180
  var radlat2 = Math.PI * lat2 / 180
  var theta = lon1 - lon2
  var radtheta = Math.PI * theta / 180
  var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta)
  dist = Math.acos(dist)
  dist = dist * 180 / Math.PI
  dist = dist * 60 * 1.1515 // result in Miles per default
  if (unit === 'K') { dist = dist * 1.609344 }
  if (unit === 'M') { dist = dist * 1.609344 * 1000 }
  if (unit === 'N') { dist = dist * 0.8684 }
  return dist
}

exports.createAddressSpeech = function (place, city, name) {
  var result = ''
  if (name) {
    result += __('speech.theLocationOfTracker') + name + __('speech.is')
  }

  if (place && city) {
    return result + place + __('speech.placeCityConjunction') + city
  } else if (city) {
    return result + city
  } else if (place) {
    return result + place
  }
  return result + __('speech.positionUnknown')
}

exports.debugLog = function (message, data) {
  var settings = Homey.manager('settings').get('gpsaccount')
  var debugLog = Homey.manager('settings').get('gpsLog') || []
  if (settings && !settings.debug) return
  var logLine = {datetime: new Date(), message: message}
  if (data) logLine.data = data

  // Push new event, remove items over 100 and save new array
  debugLog.push(logLine)
  if (debugLog.length > 100) debugLog.splice(0, 1)
  Homey.log(this.epochToTimeFormatter(), message, data || '')
  Homey.manager('settings').set('gpsLog', debugLog)
  Homey.manager('api').realtime('gpsLog', logLine)
} // function debugLog

exports.epochToTimeFormatter = function (epoch) {
  if (epoch == null) epoch = new Date().getTime()
  return (new Date(epoch)).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1')
}
