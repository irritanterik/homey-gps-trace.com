var http = require('http.min')
var util = require('util')
var EventEmitter = require('events')

const apiEndpoint = 'https://trc-api.wialon.com/wialon/ajax.html'
// https://trc-api.wialon.com/wialon/ajax.html?svc=core/get_hw_types&params={}&sid=013f29b7ec0a24cc2355bf8fb9e83596
const apiSearchItemsTemplate = {spec:{itemsType:'avl_unit',propName:'sys_name',propValueMask:'*',sortType:'sys_name'},force:1,flags:257,from:0,to:0}
//const apiSearchItemsTemplate = {spec:{itemsType:'avl_unit',propName:'sys_name',propValueMask:'*',sortType:'sys_name'},force:1,flags:1,from:0,to:0}
const apiError = {
	0:'ERR 0: Successful operation (for example for logout it will be success exit)',
  1:'ERR 1: Invalid session',
	2:'ERR 2: Invalid service name',
	3:'ERR 3: Invalid result',
	4:'ERR 4: Invalid input',
	5:'ERR 5: Error performing request',
	6:'ERR 6: Unknown error',
	7:'ERR 7: Access denied',
	8:'ERR 8: Invalid user name or password',
	9:'ERR 9: Authorization server is unavailable',
	10:'ERR 10: Reached limit of concurrent requests',
	1001:'ERR 1001: No messages for selected interval',
	1002:'ERR 1002: Item with such unique property already exists or item cannot be created according to billing restrictions',
	1003:'ERR 1003: Only one request is allowed at the moment',
	1004:'ERR 1004: Limit of messages has been exceeded',
	1005:'ERR 1005: Execution time has exceeded the limit',
	1011:'ERR 1011: Your IP has changed or session has expired',
	2014:'ERR 2014: Selected user is a creator for some system objects, thus this user cannot be bound to a new account'
}

function Location(options) {
	EventEmitter.call(this)
	if (options == null) { options = {} }
	this.user = options.user
	this.password = options.password
	this.userId = null
	this.activeSessionId = null
	this.activeSessionLast = null
	this.intervalMS = options.intervalMS || 10000;
	this.lastpos = {}
	this.trackingItems = [];
	this.intervalId = null;
}
util.inherits(Location, EventEmitter);

Location.prototype.getOptions = function(){
	self = this
	var options = {
		user: self.user,
		userId: self.userId,
		activeSessionId: self.activeSessionId,
		trackingItems: self.trackingItems
	}
	return options
}

Location.prototype.getItems = function(callback) {
	var self = this
	checkActiveSession(self, function(){
		getItems(self.activeSessionId, callback)
	})
} // End of Location.prototype.getItems

//Location.prototype.getItemType

Location.prototype.getAddressForItem = function(itemId, callback) {
	var self = this
	checkActiveSession(self, function(){
		getPosition(itemId, self.activeSessionId, function(error, position) {
			if(error) {self.emit('error', error); return callback(error)}
			getAddress(position, self.userId, function(error, address){
				if(error) {self.emit('error', error); return callback(error)}
				return callback(null, address)
			})
		})
	})
} // End of Location.prototype.getAddressForItem

Location.prototype.getPositionForItem = function(itemId, callback) {
	var self = this
	checkActiveSession(self, function(){
		getPosition(itemId, self.activeSessionId, callback)
	})
}

Location.prototype.validateAccount = function(callback) {
	var self = this
	if (!self.user) 	  { callback('No username set'); return }
	if (!self.password) { callback('No password set'); return }

	login(self.user, self.password, function(error, sessionId, userId) {
		if (error) return callback(error)
		callback(null, userId)
		logout(sessionId)
	})
}

Location.prototype.startTracking = function(items) {
	var self = this
//	console.log('## Start tracking for devices:', items, ' with interval:', this.intervalMS)
	this.trackingItems = []
	items.forEach(function(itemId){
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
		function() { Tracking(self) }
	,self.intervalMS)
}

Location.prototype.stopTracking = function() {
	var self = this
//	console.log('## Stop tracking for devices:', self.trackingItems)
	self.trackingItems = []
	if (self.intervalId) clearInterval(self.intervalId)
}

function Tracking(self) {
 checkActiveSession(self, function(){
 	self.trackingItems.forEach(function(item){
 		getPosition(item.itemId, self.activeSessionId, function(error, position) {
			if(error){
				self.emit('error', error)
			} else {
				// check diff
				if (position.x != item.x ||
					  position.y != item.y ||
						position.z != item.z ||
						position.c != item.c ||
						position.s != item.s) {
					first = item.x==null?true:false
					var distanceMeters = calculateDistance(position.y, position.x, item.y, item.x, 'M')
					item.x = position.x
					item.y = position.y
					item.z = position.z
					item.c = position.c
					item.s = position.s
					item.t = position.t
					item.distance = distanceMeters
					if (distanceMeters > 5 || first){
						getAddress(position, self.userId, function(error, body){
							if (error) {self.emit('error', error); return}
							item.address = body
							if (first){
								self.emit('firstPosition', item.itemId, item)
							} else {
								self.emit('newPosition', item.itemId, item)
							}
						})
					} else {
						self.emit('newMessage', item.itemId, item)
					}
				} else if (position.t != item.t) {
					item.t = position.t
					item.distance = 0
					self.emit('newMessage', item.itemId, item)
				}
			}
 		})
 	})
 })
}

function checkActiveSession(obj, callback) {
	if (obj.activeSessionId == null ||
			(obj.activeSessionLast + (4 * 50 * 1000)) < (new Date).getTime()) {
		console.log('    --> new activeSessionId needed' )
		login(obj.user, obj.password, function(error, sessionId, userId) {
			if (error) {obj.emit('error', error); return}
			obj.userId = userId
			obj.activeSessionId = sessionId
			obj.activeSessionLast = (new Date).getTime()
			callback()
		})
	} else {
		obj.activeSessionLast = (new Date).getTime()
		callback()
	}
} // End of checkActiveSession

// login function returns sessionId
function login(user, password, callback) {
	if (!user) 		 { callback('No username set'); return }
	if (!password) { callback('No password set'); return }
	getApiResponse({
		svc: 'core/login', params: JSON.stringify({user: user, password: password})},
		function (e, b) {callback(e,(b==null?null:b.eid),(b==null?null:b.user.id))}
	)
} // end function login

function logout(sessionId) {
	getApiResponse({
		svc: 'core/logout', params: JSON.stringify({}), sid: sessionId},
		function (e, b) {if (e){ Console.error('Warning: error on logout: ', e)}}
	)
}

// function getItems returns array of trackable items, array can be empty
function getItems(sessionId, callback) {
	getApiResponse({
		svc: 'core/search_items', params: JSON.stringify(apiSearchItemsTemplate), sid: sessionId},
		function (e, b) {callback(e,(b==null?null:b.items))}
	)
} // end function getItems

function getHwTypes(itemIds, sessionId, callback) {
 var itemArray = (itemIds.length==null?[itemIds]:itemIds)
	getApiResponse({
		svc: 'core/get_hw_types', params: JSON.stringify({filterType: 'id', filterValue: itemArray, includeType: true}), sid: sessionId},
		function (e, b){callback(e, b)}
	)
} // end function getHwTypes

// function getPosition returns long, Lat and lastupdate for a Item
function getPosition(itemId, sessionId, callback) {
	getApiResponse({
		svc: 'core/search_item', params: JSON.stringify({id: itemId, flags: 1025}), sid: sessionId},
		function (e, b) {callback(e,(b==null?null:b.item.pos))}
	)
} // end function getPosition

function calculateDistance(lat1, lon1, lat2, lon2, unit) {
	// based on https://www.geodatasource.com/developers/javascript
	var radlat1 = Math.PI * lat1/180
	var radlat2 = Math.PI * lat2/180
	var theta = lon1-lon2
	var radtheta = Math.PI * theta/180
	var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
	dist = Math.acos(dist)
	dist = dist * 180/Math.PI
	dist = dist * 60 * 1.1515 // result in Miles per default
	if (unit=="K") { dist = dist * 1.609344 }
	if (unit=="M") { dist = dist * 1.609344 * 1000}
	if (unit=="N") { dist = dist * 0.8684 }
	return dist
}

function getAddress(position, userId, callback){
	// todo: normalise output to string

	// two step process, first try with openmaps, then with wialon
	var osmOptions = {
		uri: 'http://nominatim.openstreetmap.org/reverse',
	  query: {format: 'json', lat: position.y, lon: position.x},
		headers: {'User-Agent': 'Homey Gps Tracking App'},
		protocol: 'http:'
	}
	// var wialonOptions = {
	// 	uri: 'http://geocode-maps.wialon.com/trc-api.wialon.com/gis_geocode',
	// 	query: {coords: JSON.stringify([{lon: position.x, lat: position.y}]),
	// 		      dist_from_unit: 1, flags: 1174405120, uid: userId},
	// 	protocol: 'http:'
	// }

	http.json(osmOptions).then(function(result){
		return callback(null, result.address)
	}).catch(function(reason){
		// http.json(wialonOptions).then(function(result){
		// 	if (result.error) {
		// 		return callback(apiError[result.error])
		// 	} else {
		// 		return callback(null, result[0])
		// 	}
		// }).catch(function(reason){
			return callback(reason)
		// })
	})
} // end getAddress function

// getApiResponse executes api request, returns body
function getApiResponse(qs, callback) {
	options = {
		uri: apiEndpoint,
		query: qs,
		protocol: 'http:'
	}
	http.json(options).then(function(result){
		if (result.error) {
			callback(apiError[result.error])
		} else {
			callback(null, result)
		}
	}).catch(function(reason){
		callback(reason)
	})
} // end getApiResponse function

exports = module.exports = Location
