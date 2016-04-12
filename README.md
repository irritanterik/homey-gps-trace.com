[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

# GPS-Trace

Track your car and phones with the free GPS-Trace.com service. You can find a list of all supported devices [here](http://gps-trace.com/en/hardware). The location of
your Homey will be added as a default geofence (later). Additional geofences can be added. (later)

### Speech triggers
 - Dude, where's my car > give's your car location (later)

### Trigger cards on device
 - Tracker moved
 - Tracker starts moving
 - Tracker stopped moving
 - Tracker entered geofence (later)
 - Tracker left geofence (later)

### Condition cards
 - Tracker is moving
 - Tracker is in geofence (later)

### Action cards
 - Update tracker (if polling is disabled) (later)
 - Say location of tracker

## settings
 - General settings
    - Account details
    - Enable polling
    - Enable debug logging
    - Geofences (later)
    - Units meters/miles selection (later)

 - Settings on device
    - 1. Minimum seconds time between movement triggers
      ('do not retrigger for 30 seconds')
    - 2. Minimum meters distance between movement triggers
    - 3. Minimum time between last new position and trigger 'stops moving'
    - 4. Icon (later)

---
#### Changelog

##### 0.0.3
- Added flow trigger 'Tracker starts moving'
- Added flow trigger 'Tracker stops moving'
- Added flow condition 'Tracker is moving'
- Implemented device setting 1, 2 and 3
- Added token 'distance' on flow trigger 'Position changed'
- Refactored code by standardjs.com template

##### 0.0.2
- Added log system on settings screen
- Added flow action 'say location'

##### 0.0.1
- Initial
---
#### TO DO (prioritized)
- Bind devices to precense of users
- Put stuff in library's
- Normalize getAddress responses output in location library (or delete wialon backup)
- Support speech triggers
- Add mobile card with mini-map with position
- Warning on account removal about ghost devices and broken flows
- Get and save tracker hw-type and hw-category
- Refactor 'updatetracker' in driver.js: centralize effectuation of change
- Improve action card 'say location': trigger other trigger cards if polling was disabled
- Select an icon on device addition
- Add API:
 - PUT new positions for a tracker
 - GET position and address for a tracker
 - Units selections meters/miles
- Do account config on first device addition if it's not done yet.
