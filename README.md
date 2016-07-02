# GPS-Trace

Track your car and phones with the free GPS-Trace.com service. You can find a list of all supported devices [here](http://gps-trace.com/en/hardware). Mobile phones are trackable with the GPS Tag Orange apps for [Android](https://play.google.com/store/apps/details?id=wialon.GPS_Tag_Orange) and [Apple](https://itunes.apple.com/app/gps-tag-orange/id766356081).
The location of your Homey will be added as a default geofence. Additional geofences can be added.

### Speech triggers
 - Dude, where is my car > give's your car location
 (NL: Gast waar is mijn <tracker naam>)

### Trigger cards on device
 - Tracker moved
 - Tracker starts moving
 - Tracker stopped moving
 - Tracker entered geofence
 - Tracker left geofence

### Condition cards
 - Tracker is moving
 - Tracker is in geofence

### Action cards
 - Say location of tracker
 - Update tracker (if polling is disabled) (later)

### Settings
 - General settings
    - Account details
      - Enable polling
      - Enable debug logging
    - Geofences
      - Add new geofences
      - Edit Geofences
      - Rename geofence (double click on map)
      - Delete geofences
      - Show trackers on map
    - Logging
 - Settings on device
    1. Minimum seconds time between movement triggers
      ('do not retrigger for 30 seconds')
    2. Minimum meters distance between movement triggers
    3. Minimum time between last new position and trigger 'stops moving'
    4. Icon (later)

## Notes
- All distance tokens on flow cards contain values in meters (rounded-up)
- Logging of movement will not survive a reboot. A first new location since reboot will (re)trigger the 'Tracker starts moving' card
- Reselect geofence names in your flow cards after renaming a geofence, to be sure the geofence is referenced right.

---
### Changelog

##### version 0.3.1
- Added support for speech triggers

##### version 0.2.1
- Bugfix on movement trigger while distance was within constraint
- Bugfix on not triggering a tracker start moving   
- Bugfix and additional logging on stop moving trigger while distance was 0m
- Bugfix on settings screen where square geofence was not editable after drawing
- Improvement on resolving city value when address contained a village name
- Improvement on initializing geofences when no trackers has been configured yet
- Logging now can be cleared on the settings screen

##### version 0.2.0
- Support polygon and rectangular geofences
- Distance values on flow card tokens are round upward to complete meters  
- Improved handeling of invalid session error in location library (try to re-establish session)
- Improved handeling of externally changed password (prospone tracking for 10 minutes)
- Improved handeling of lost network connection location library (prospone tracking for 10 minutes after 2 minutes of connection issues)

##### version 0.1.2
- Added logging on geofence flow trigger evaluations
- Improved Readme

##### version 0.1.1
- Bugfix on broken flow action 'Say location of tracker'

##### version 0.1.0 Major pre-release
- Improved debug logging on 'internal' errors
- Flow trigger 'Tracker starts moving' now holds previous known location in address tokens
- Flow trigger 'Tracker stops moving' now has tokens for start location and end location
- Rearranged settings screen
- Added real-time logging on setting screen
- Added real-time updates of trackers on setting screen
- Added settings screen for geofences
- Support multiple geofences
- Added auto-creation of default geofence
- Added flow trigger 'Tracker entered geofence'
- Added flow trigger 'Tracker left geofence'
- Added flow condition 'Tracker is in geofence'
- Added API get method '/trackers' that returns all tracker objects

##### version 0.0.4
- Fixed bug where something only worked theoretically
- Put stuff in library's

##### version 0.0.3
- Added flow trigger 'Tracker starts moving'
- Added flow trigger 'Tracker stops moving'
- Added flow condition 'Tracker is moving'
- Implemented device setting 1, 2 and 3
- Added token 'distance' on flow trigger 'Position changed'
- Refactored code by standardjs.com template
- Prepared stuff for route analysis

##### version 0.0.2
- Added log system on settings screen
- Added flow action 'say location'

##### version 0.0.1
- Initial checkin

---
### TO DO (prioritized)
- Bind devices to presence of users (can be done with standard flow for now)
- Normalize getAddress responses output in location library
- Refactor 'updatetracker' in driver.js: centralize effectuation of changed location
- Improve action card 'say location': trigger other trigger cards if polling was disabled
- Warn on account removal about ghost devices and broken flows
- Get and save tracker hw-type and hw-category
- Select an icon on device addition
- Units selections meters/miles (based on Homey.manager('i18n'))
- Add driver for external API based trackers (push)
- Extend API
- PUT new positions for a tracker
- Add mobile card with mini-map with position (not yet supported by API)
- Save trips
- Show trips start and end points on map in Settings
- Show trips routes on map in Settings
- Automatic create geofences based on start and endpoint collections

### Donate
Help me getting a Tesla Model S/3/X with a small [donation](http://PayPal.Me/ErikvanDongen). After delivery of the vehicle i will release a Homey app for Tesla a.s.a.p. ;).
