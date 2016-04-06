"use strict";

var self = module.exports = {
	init: function () {
		Homey.log('  app.js init function')
		Homey.log('######### GPS TRACKING #############################################')

// disabled: no arguments on this card
// 		Homey.manager('flow').on('trigger.tracker_moved', function( callback, args, state ){
// 			Homey.log('in flow trigger.tracker_moved with args, state:', args, state)
// 			Homey.log('  --> trigger flow!')
// 			callback( null, true);
// 		})

		// Homey.manager('settings').on('set', function(setting){
		// 	if (setting == 'gpsaccount') {
		// 		Homey.log('Account has been changed/updated...')
		// 		initiateTracking()
		// 	}
		// })
		// initiateTracking()
	} // end of module init function
}
