'use strict'
var Geofences = require('./lib/geofences.js')
var FlowActions = require('../../lib/flow/actions.js')
var FlowConditions = require('../../lib/flow/conditions.js')
var FlowTriggers = require('../../lib/flow/triggers.js')
var SpeechHandlers = require('../../lib/speech/speech.js')

var self = module.exports = { // eslint-disable-line
  init: function () {
    Geofences.geofencesInitiationOnAppStart()
    FlowTriggers.init()
    FlowConditions.init()
    FlowActions.init()
    SpeechHandlers.init()
  } // end of module init function
}
