/* global $, google */

var map
var trackers = {}
var trackerMarkers = []
var geofences = {}
var geofenceMarkers = []
var homeyMarkers = []
var activeGeofenceId = null

function initGeofences () {
  createMap()
  loadHomeyLocation()
  loadGeofences()
  loadTrackers()
  subscribeTrackerUpdates()
}

function createMap () {
  var mapOptions = {
    zoom: 17,
    maxZoom: 20,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    streetViewControl: false
  }
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions)

  google.maps.event.addListener(map, 'click', function () {
    if (activeGeofenceId) deselectGeofence()
  })
}

function getGeofenceMarkersIndexById (geofenceId) {
  var geofenceIndex = null
  geofenceMarkers.forEach(function (geofence, index) {
    if (geofenceMarkers[index].geofenceId == geofenceId) { // eslint-disable-line
      geofenceIndex = index
    }
  })
  return geofenceIndex
}

function showGeofences () {
  google.maps.event.trigger(map, 'resize')
  centerMap(trackerMarkers.concat(homeyMarkers))
}

function loadHomeyLocation () {
  Homey.api('GET', '/geofence/self', function (error, result) {
    if (error) return console.error(error)
    var icon = {
      url: 'images/homey.webp',
      scaledSize: new google.maps.Size(30, 30),
      anchor: new google.maps.Point(15, 15)
    }
    var marker = new google.maps.Marker({
      map: map,
      icon: icon,
      position: new google.maps.LatLng(result.latitude, result.longitude),
      draggable: false
    })
    homeyMarkers.push(marker)
  })
}

function loadGeofences () {
  Homey.get('geofences', function (error, result) {
    if (error) return console.error(error)
    if (geofenceMarkers) {
      for (var i = 0; i < geofenceMarkers.length; i++) {
        geofenceMarkers[i].setMap(null)
      }
      geofenceMarkers.length = 0
    }
    if (!result) return console.warn('No geofences to load!')
    geofences = result
    $('#geofences').find('option').remove()
    $.each(geofences, function (geofenceId, geofence) {
      $('#geofences').append('<option value=' + geofenceId + '>' + geofence.name + ' (' +
      __('settings.geofences.geofencesourcetype.' + geofence.source.toUpperCase()) + ')</option>')
      if (geofence.type === 'CIRCLE') {
        var circle = new google.maps.Circle({
          geofenceId: geofenceId,
          disableDoubleClickZoom: true,
          editable: false,
          draggable: false,
          map: map,
          center: new google.maps.LatLng(geofence.circle.center.lat, geofence.circle.center.lng),
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.25,
          radius: geofence.circle.radius
        })
        geofenceMarkers.push(circle)
        google.maps.event.addListener(circle, 'radius_changed', function () {
          saveGeofence(circle.geofenceId)
        })
        google.maps.event.addListener(circle, 'center_changed', function () {
          saveGeofence(circle.geofenceId)
        })
        google.maps.event.addListener(circle, 'click', function () {
          selectGeofence(circle.geofenceId)
        })
        google.maps.event.addListener(circle, 'dblclick', function (event) {
          selectGeofence(circle.geofenceId)
          renameGeofence(circle.geofenceId)
          event.stop()
        })
      } // end if circle
    })
    if (geofences) {
      if (!activeGeofenceId) {
        $('#geofences').val(geofenceMarkers[0].geofenceId)
      } else {
        $('#geofences').val(activeGeofenceId)
      }
    }
  })
}

function geofenceNameExists (checkName) {
  var result = false
  $.each(geofences, function (index, geofence) {
    if (geofence.name.toUpperCase() === checkName.toUpperCase()) {
      result = index
      return
    }
  })
  return result
}

function renameGeofence (geofenceId) {
  var newName = window.prompt(__('settings.geofences.labelNameGeofence'), geofences[geofenceId].name)
  if (!newName) return
  if (geofenceNameExists(newName) !== geofenceId) {
    window.alert(__('settings.geofences.errorGeofenceNameUnique'))
    return renameGeofence(geofenceId)
  }
  geofences[geofenceId].name = newName
  var listText = geofences[geofenceId].name + ' (' + __('settings.geofences.geofencesourcetype.' + geofences[geofenceId].source.toUpperCase()) + ')'
  $('#geofences option:selected').text(listText)
  saveGeofence(geofenceId)
}

function deselectGeofence () {
  if (!activeGeofenceId) return
  var index = getGeofenceMarkersIndexById(activeGeofenceId)
  geofenceMarkers[index].setEditable(false)
  activeGeofenceId = null
}

function selectGeofence (geofenceId) {
  if (activeGeofenceId) deselectGeofence(activeGeofenceId)
  activeGeofenceId = geofenceId
  $('#geofences').val(activeGeofenceId)
  var markerIndex = getGeofenceMarkersIndexById(activeGeofenceId)
  geofenceMarkers[markerIndex].setEditable(true)
}

function saveGeofence (geofenceId) {
  if (geofenceId) {
    var markerIndex = getGeofenceMarkersIndexById(geofenceId)
    if (geofences[geofenceId].type === 'CIRCLE') {
      geofences[geofenceId].circle.center.lat = geofenceMarkers[markerIndex].center.lat()
      geofences[geofenceId].circle.center.lng = geofenceMarkers[markerIndex].center.lng()
      geofences[geofenceId].circle.radius = geofenceMarkers[markerIndex].radius
    }
  }
  Homey.set('geofences', geofences)
}

function centerMap (markersCollection) {
  var latlngbounds = new google.maps.LatLngBounds()
  for (var i = 0; i < markersCollection.length; i++) {
    latlngbounds.extend(markersCollection[i].position)
  }
  map.setCenter(latlngbounds.getCenter())
  map.fitBounds(latlngbounds)
}

function deleteGeofence () {
  deselectGeofence()
  delete geofences[$('#geofences').val()]
  if ($.isEmptyObject(geofences)) geofences = null
  saveGeofence()
  loadGeofences()
}

function addGeofence () {
  var newName = window.prompt(__('settings.geofences.labelNameGeofence'), __('settings.geofences.newGeofenceName'))
  if (!newName) return
  if (geofenceNameExists(newName)) {
    window.alert(__('settings.geofences.errorGeofenceNameUnique'))
    return addGeofence()
  }
  var newGeofenceId = new Date().getTime()
  var newGeofence = {
    version: 0,
    name: newName,
    source: 'USER',
    type: 'CIRCLE',
    circle: {
      radius: 50,
      center: {
        lat: map.center.lat(),
        lng: map.center.lng()
      }
    },
    active: true,
    isHome: false
  }
  if (!geofences) geofences = {}
  geofences[newGeofenceId] = newGeofence
  activeGeofenceId = newGeofenceId
  saveGeofence()
  loadGeofences()
}

function changeGeofenceList () {
  deselectGeofence()
  var geofenceId = $('#geofences').val()
  var index = getGeofenceMarkersIndexById(geofenceId)
  if (geofences[geofenceId].type === 'CIRCLE') {
    map.setCenter(geofenceMarkers[index].getCenter())
  }
}

function editGeofence () {
  if ($('#geofences').val()) selectGeofence($('#geofences').val())
}

function showTrackersChange () {
  if ($('#showTrackers').prop('checked')) {
    showTrackers()
  } else {
    hideTrackers()
  }
}

function showTrackers () {
  trackerMarkers.forEach(function (marker) {
    marker.setMap(map)
  })
  centerMap(trackerMarkers.concat(homeyMarkers))
}

function hideTrackers () {
  trackerMarkers.forEach(function (marker) {
    marker.setMap(null)
  })
}

function loadTrackers () {
  trackerMarkers = []
  Homey.api('GET', '/trackers', function (error, result) {
    if (error) return console.error(error)
    trackers = result
    $.each(trackers, function (trackerId) {
      var trackerLocation = new google.maps.LatLng(trackers[trackerId].location.lat, trackers[trackerId].location.lng)
      var infowindow = new google.maps.InfoWindow({
        content: '' + trackers[trackerId].name
      })
      var trackerMarker = new google.maps.Marker({
        position: trackerLocation,
        map: null,
        draggable: false
      })
      trackerMarker.trackerId = trackerId
      google.maps.event.addListener(trackerMarker, 'click', function () {
        infowindow.open(map, trackerMarker)
      })
      trackerMarkers.push(trackerMarker)
    })
    showTrackers()
  })
}

function subscribeTrackerUpdates () {
  Homey.on('gpsLocation', function (data) {
    console.log('Tracker: new location ', data)
    $.each(trackerMarkers, function (index) {
      if (trackerMarkers[index].trackerId === data.trackerId) {
        trackerMarkers[index].setPosition(new google.maps.LatLng(data.location.lat, data.location.lng))
      }
    })
  })
}
