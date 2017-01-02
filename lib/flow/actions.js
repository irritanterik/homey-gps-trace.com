/* global Homey */
var Util = require('../util.js')

exports.init = function () {
  Homey.manager('flow').on('action.get_position', onActionGetPosition)
  Homey.manager('flow').on('action.say_address', onActionSayAddress)
}

function onActionGetPosition (callback, args) {
  Util.debugLog('Flow action get_position', args)
  // TODO: force position update for tracker if polling is disabled
  // TODO: do *all* the update and trigger magic here
}

function onActionSayAddress (callback, args, state) {
  Util.debugLog('Flow action say_address', args, state)

  var tracker = Homey.manager('drivers').getDriver('tracker').getTrackers()[args.device.id]
  var result = Util.createAddressSpeech(tracker.location.place, tracker.location.city, tracker.name)
  Util.debugLog('Speech result', result)
  Homey.manager('speech-output').say(result, {session: state.session})
  callback(null, true)
}
