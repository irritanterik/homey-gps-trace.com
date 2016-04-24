# GPS-Trace

Track your car and phones with the free GPS-Trace.com service. You can find a list of all supported devices [here](http://gps-trace.com/en/hardware). The location of
your Homey will be added as a default geofence (later). Additional geofences can be added. (later)

### Speech triggers
 - Dude, where's my car > give's your car location (later)

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
 - Update tracker (if polling is disabled) (later)
 - Say location of tracker

### Settings
 - General settings
    - Account details
    - Enable polling
    - Enable debug logging
    - Geofences
    - Units meters/miles selection (later)

 - Settings on device
    - 1. Minimum seconds time between movement triggers
      ('do not retrigger for 30 seconds')
    - 2. Minimum meters distance between movement triggers
    - 3. Minimum time between last new position and trigger 'stops moving'
    - 4. Icon (later)

---
### Changelog

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
- Support speech triggers
- Support polygon geofences
- Bind devices to precense of users
- Normalize getAddress responses output in location library (or delete wialon backup)
- Improve handeling of invalid session error in location library
- Warning on account removal about ghost devices and broken flows
- Get and save tracker hw-type and hw-category
- Refactor 'updatetracker' in driver.js: centralize effectuation of change
- Improve action card 'say location': trigger other trigger cards if polling was disabled
- Select an icon on device addition
- Units selections meters/miles
- Add driver for external API based trackers (push)
- Extend API
- PUT new positions for a tracker
- Add mobile card with mini-map with position (not yet supported by API)
