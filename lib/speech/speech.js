/* global Homey */
var Util = require('../util.js')

exports.init = function () {
  Homey.manager('speech-input').on('speech', onSpeechInput)
}

function onSpeechInput (speech, callback) {
  Util.debugLog('Evaluating speech trigger', speech)
  var settings = Homey.manager('settings').get('gpsaccount')
  if (!settings || !settings.speech) { return callback(true, null) }
  if (!speech.devices) return callback(true, null)

  speech.devices.forEach((device) => {
    var tracker = Homey.manager('drivers').getDriver('tracker').getTrackers()[device.data]
    var result = Util.createAddressSpeech(tracker.location.place, tracker.location.city, tracker.name)
    Util.debugLog('Speech result', result)
    speech.say(result)
    callback(null, true)
  })
}
