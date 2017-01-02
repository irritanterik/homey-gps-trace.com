/* global __, Homey */
var Inside = require('point-in-polygon')

const geofenceVersion = 0
const geofenceRadiusDefault = 50

exports.calculateDistance = function (lat1, lon1, lat2, lon2, unit) {
  // based on https://www.geodatasource.com/developers/javascript
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0
  unit = (unit || 'M').toUpperCase()
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

exports.geofencesFilteredList = function (value) {
  var list = []
  var geofences = Homey.manager('settings').get('geofences')
  if (!geofences) return list
  Object.keys(geofences).forEach(geofenceId => {
    list.push({id: geofenceId, name: geofences[geofenceId].name, geofenceId: geofenceId})
  })
  return list.filter((item) => item.name.toLowerCase().includes(value.toLowerCase())).sort((a, b) => (a.name > b.name ? 1 : -1))
}

exports.geofencesInitiationOnAppStart = function () {
  var geofences = Homey.manager('settings').get('geofences')
  if (!geofences) {
    geofences = {}
    getHomeyGeofenceDefault(function (defaultGeoFence) {
      var newGeofenceId = new Date().getTime()
      geofences[newGeofenceId] = defaultGeoFence
      Homey.manager('settings').set('geofences', geofences)
    })
  }
}

exports.geofencesLocationMatch = function (location) {
  var result = []
  var geofences = Homey.manager('settings').get('geofences')
  if (!geofences) return result
  Object.keys(geofences).forEach((geofenceId) => {
    var locationMatch = false
    if (geofences[geofenceId].type === 'CIRCLE') {
      var distance = this.calculateDistance(
        location.lat, location.lng,
        geofences[geofenceId].circle.center.lat, geofences[geofenceId].circle.center.lng,
        'M'
      )
      locationMatch = !!(distance < geofences[geofenceId].circle.radius)
    } else {
      if (geofences[geofenceId].type === 'POLYGON') {
        locationMatch = Inside([location.lat, location.lng], geofences[geofenceId].polygon.path.map(point => [point.lat, point.lng]))
      } else {
        locationMatch = Inside([location.lat, location.lng], geofences[geofenceId].rectangle.path.map(point => [point.lat, point.lng]))
      }
    }
    if (locationMatch) result.push(geofenceId)
  })
  return result
}

function getHomeyGeofenceDefault (ready) {
  Homey.manager('geolocation').getLocation(function (error, homeyLocation) {
    if (error) console.error(error)
    var result = {
      version: geofenceVersion,
      name: __('defaultGeofenceName'),
      source: 'DEFAULT',
      type: 'CIRCLE',
      circle: {
        radius: geofenceRadiusDefault,
        center: {
          lat: homeyLocation.latitude || 52,
          lng: homeyLocation.longitude || 5
        }
      },
      active: true,
      isHome: true
    }
    ready(result)
  })
} // end of getGeofenceDefault function
