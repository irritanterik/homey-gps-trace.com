var http = require('http.min')
var util = require('util')
var EventEmitter = require('events')

const apiEndpoint = 'http://trc-api.wialon.com/wialon/ajax.html'
const maxSessionRetryCount = 3 // number of retries on invalid session errors before shutdown logging
const maxNetworkIssueMinutes = 2 // number of minutes before shutdown logging
const apiSearchItemsTemplate = {
  spec: {
    itemsType: 'avl_unit', propName: 'sys_name', propValueMask: '*', sortType: 'sys_name'}, force: 1, flags: 257, from: 0, to: 0}
// TODO: Template Request for HW-types https://trc-api.wialon.com/wialon/ajax.html?svc=core/get_hw_types&params={}&sid=013f29b7ec0a24cc2355bf8fb9e83596
const apiError = {
  0: 'ERR 0: Successful operation (for example for logout it will be success exit)',
  1: 'ERR 1: Invalid session',
  2: 'ERR 2: Invalid service name',
  3: 'ERR 3: Invalid result',
  4: 'ERR 4: Invalid input',
  5: 'ERR 5: Error performing request',
  6: 'ERR 6: Unknown error',
  7: 'ERR 7: Access denied',
  8: 'ERR 8: Invalid user name or password',
  9: 'ERR 9: Authorization server is unavailable',
  10: 'ERR 10: Reached limit of concurrent requests',
  1001: 'ERR 1001: No messages for selected interval',
  1002: 'ERR 1002: Item with such unique property already exists or item cannot be created according to billing restrictions',
  1003: 'ERR 1003: Only one request is allowed at the moment',
  1004: 'ERR 1004: Limit of messages has been exceeded',
  1005: 'ERR 1005: Execution time has exceeded the limit',
  1011: 'ERR 1011: Your IP has changed or session has expired',
  2014: 'ERR 2014: Selected user is a creator for some system objects, thus this user cannot be bound to a new account'
}

function Location (options) {
  EventEmitter.call(this)
  if (options == null) { options = {} }
  this.user = options.user
  this.password = options.password
  this.userId = null
  this.activeSessionId = null
  this.activeSessionLast = null
  this.failedSessionCount = 0
  this.networkFailureStart = null
  this.trackingItems = []
  this.intervalId = null
  this.intervalMS = options.intervalMS || 10000
}
util.inherits(Location, EventEmitter)

Location.prototype.getOptions = function () {
  var self = this
  var options = {
    user: self.user,
    userId: self.userId,
    activeSessionId: self.activeSessionId,
    trackingItems: self.trackingItems
  }
  return options
}

Location.prototype.getItems = function (callback) {
  var self = this
  checkActiveSession(self, function () {
    getItems(self.activeSessionId, callback)
  })
} // End of Location.prototype.getItems

Location.prototype.getAddressForItem = function (itemId, callback) {
  var self = this
  checkActiveSession(self, function () {
    getPosition(itemId, self.activeSessionId, function (error, position) {
      if (error) return handleError(self, error, 'getAddressForItem > getPosition')
      getAddress(position, self.userId, function (error, address) {
        if (error) return handleError(self, error, 'getAddressForItem > getAddress')
        return callback(address)
      })
    })
  })
} // End of Location.prototype.getAddressForItem

Location.prototype.getPositionForItem = function (itemId, callback) {
  var self = this
  checkActiveSession(self, function () {
    getPosition(itemId, self.activeSessionId, callback)
  })
}

Location.prototype.validateAccount = function (callback) {
  var self = this
  if (!self.user) { return callback('No username set') }
  if (!self.password) { return callback('No password set') }

  login(self.user, self.password, function (error, sessionId, userId) {
    if (error) return callback(error)
    callback(null, userId)
    logout(sessionId)
  })
}

Location.prototype.startTracking = function (items) {
  var self = this
  this.trackingItems = []
  this.networkFailureStart = null
  this.failedSessionCount = 0
  items.forEach(function (itemId) {
    self.trackingItems.push({
      itemId: itemId,
      t: null,
      x: null,
      y: null,
      z: null,
      c: null,
      s: null
    })
  })
  Tracking(this)
  this.intervalId = setInterval(
    function () { Tracking(self) }
  , self.intervalMS)
}

Location.prototype.stopTracking = function () {
  var self = this
  self.trackingItems = []
  this.failedSessionCount = 0
  if (self.intervalId) clearInterval(self.intervalId)
}

function Tracking (self) {
  checkActiveSession(self, function () {
    self.trackingItems.forEach(function (item) {
      getPosition(item.itemId, self.activeSessionId, function (error, position) {
        if (error) return handleError(self, error, 'internal > Tracking > getPosition')
        // check diff
        if (position.x !== item.x ||
            position.y !== item.y ||
            position.z !== item.z ||
            position.c !== item.c ||
            position.s !== item.s) {
          item.distance = calculateDistance(position.y, position.x, item.y, item.x, 'M')
          item.x = position.x
          item.y = position.y
          item.z = position.z
          item.c = position.c
          item.s = position.s
          item.t = position.t
          if (item.distance > 0 || !item.address) {
            getAddress(position, self.userId, function (error, body) {
              if (error) return handleError(self, error, 'internal > Tracking > getAddress')
              item.address = body
              self.emit('location', item.itemId, item)

              // were so deep here, reset error handling indicators
              this.networkFailureStart = null
              this.failedSessionCount = 0
            })
          } else {
            self.emit('message', item.itemId, item)
          }
        } else if (position.t !== item.t) {
          item.t = position.t
          item.distance = 0
          self.emit('message', item.itemId, item)
        }
      })
    })
  })
}

function handleError (obj, error, source) {
  // invalid wialon session
  if (error === apiError[1]) {
    obj.failedSessionCount += 1
    if (obj.failedSessionCount >= maxSessionRetryCount) {
      obj.stopTracking()
      return obj.emit('tracking_terminated', 'Too many failed session errors')
    }
  }
  // invalid username or password
  if (error === apiError[8]) {
    obj.stopTracking()
    return obj.emit('tracking_terminated', 'Invalid user name or password')
  }
  // no internet connection
  if (error.stack && error.stack.toUpperCase().indexOf('ENOTFOUND') > -1) {
    if (!obj.networkFailureStart) obj.networkFailureStart = new Date().getTime()
    if (((new Date().getTime() - obj.networkFailureStart) / 1000 / 60) >= maxNetworkIssueMinutes) {
      obj.stopTracking()
      return obj.emit('tracking_terminated', 'Network connection errors for more than ' + maxNetworkIssueMinutes + ' minutes.')
    } else {
      return obj.emit('error', {function: source, error: 'Could not connect to ' + error.hostname})
    }
  }

  obj.emit('error', {function: source, error: error, stack: error.stack})
} // end function handleError

function checkActiveSession (obj, callback) {
  if (obj.activeSessionId == null ||
     (obj.activeSessionLast + (4 * 50 * 1000)) < new Date().getTime() ||
     obj.failedSessionCount > 0) {
    login(obj.user, obj.password, function (error, sessionId, userId) {
      if (error) return handleError(obj, error, 'internal > checkActiveSession > login')
      obj.userId = userId
      obj.activeSessionId = sessionId
      obj.activeSessionLast = new Date().getTime()
      obj.failedSessionCount = 0
      callback()
    })
  } else {
    obj.activeSessionLast = new Date().getTime()
    callback()
  }
} // End of checkActiveSession

// login function returns sessionId
function login (user, password, callback) {
  if (!user) { callback('No username set'); return }
  if (!password) { callback('No password set'); return }
  getApiResponse({
    svc: 'core/login', params: JSON.stringify({user: user, password: password})},
    function (e, b) { callback(e, (b == null ? null : b.eid), (b == null ? null : b.user.id)) }
  )
} // end function login

function logout (sessionId) {
  getApiResponse({
    svc: 'core/logout', params: JSON.stringify({}), sid: sessionId},
    function (e, b) { if (e) { console.error('Warning: error on logout: ', e) } }
  )
}

// function getItems returns array of trackable items, array can be empty
function getItems (sessionId, callback) {
  getApiResponse({
    svc: 'core/search_items', params: JSON.stringify(apiSearchItemsTemplate), sid: sessionId},
    function (e, b) { callback(e, (b == null ? null : b.items)) }
  )
} // end function getItems

// function getHwTypes (itemIds, sessionId, callback) {
//   var itemArray = (itemIds.length == null ? [itemIds] : itemIds)
//   getApiResponse({
//     svc: 'core/get_hw_types', params: JSON.stringify({filterType: 'id', filterValue: itemArray, includeType: true}), sid: sessionId},
//     function (e, b) { callback(e, b) }
//   )
// } // end function getHwTypes

// function getPosition returns long, Lat and lastupdate for a Item
function getPosition (itemId, sessionId, callback) {
  getApiResponse({
    svc: 'core/search_item', params: JSON.stringify({id: itemId, flags: 1025}), sid: sessionId},
    function (e, b) { callback(e, (b == null ? null : b.item.pos)) }
  )
} // end function getPosition

function calculateDistance (lat1, lon1, lat2, lon2, unit) {
  // based on https://www.geodatasource.com/developers/javascript
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0

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

function getAddress (position, userId, callback) {
  // todo: normalise output to string here, not in driver.js
  var osmOptions = {
    uri: 'http://nominatim.openstreetmap.org/reverse',
    query: {format: 'json', lat: position.y, lon: position.x},
    headers: {
      'User-Agent': 'Homey Gps Tracking App - https://github.com/irritanterik/homey-gps-trace.com',
      'Accept-Language': __('settings.OSMlanguage')  // TODO: pass through location settings
    },
    protocol: 'http:'
  }
  http.json(osmOptions).then(function (result) {
    callback(null, result.address)
  }).catch(function (reason) {
    callback(reason)
  })
} // end getAddress function

// getApiResponse executes api request, returns body
function getApiResponse (qs, callback) {
  var options = {
    uri: apiEndpoint,
    query: qs
  }
  http.json(options).then(function (result) {
    if (result.error) {
      callback(apiError[result.error])
    } else {
      callback(null, result)
    }
  }).catch(function (reason) {
    callback(reason)
  })
} // end getApiResponse function

exports = module.exports = Location
