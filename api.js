var Location = require('./lib/location.js')

module.exports = [{
  // validate account for use with settings page
  description: 'Validate gps-trace.com account settings',
  method: 'GET',
  path: '/validate/account',
  requires_authorization: true,
  role: 'owner',
  fn: function (callback, args) {
    var tracking = new Location({
      user: args.query.user,
      password: args.query.password
    })
    tracking.validateAccount(function (error, userId) {
      tracking = null
      switch (error) {
        case null: // success!
          return callback(null, {UserId: userId})
        case 'No username set':
          return callback(1)
        case 'No password set':
          return callback(2)
        case 'ERR 8: Invalid user name or password':
          return callback(10)
        default: // other API error
          return callback(11)
      }
    })
  }
}, {
  description: 'Get location of Homey',
  method: 'GET',
  path: '/geofence/self',
  requires_authorization: true,
  role: 'owner',
  fn: function (callback, args) {
    Homey.manager('geolocation').getLocation(callback)
  }
}, {
  description: 'Get all trackers',
  method: 'GET',
  path: '/trackers',
  requires_authorization: true,
  role: 'owner',
  fn: function (callback, args) {
    callback(null, Homey.manager('drivers').getDriver('tracker').getTrackers())
  }
}]
