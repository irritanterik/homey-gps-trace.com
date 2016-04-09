# GPS-Trace

Track your car and phones with the free GPS-Trace.com service. You can find a list of all supported devices [here](http://gps-trace.com/en/hardware). The location of
your Homey will be added as a default geofence (later). Additional geofences can be added. (later)

### Speech triggers
 - Dude, where's my car > give's your car location (later)

### Trigger cards
 - Tracker moved
 - Tracker starts moving (later)
 - Tracker stopped movin (later)
 - Tracker entered geofence (later)
 - Tracker left geofence (later)

### Condition cards
 - Tracker is moving (later)
 - Tracker is in geofence (later)

### Action cards
 - Update tracker (if polling is disabled)
 - Say location of tracker

## settings
 - General settings
    - Account details
    - Enable polling
    - Enable debug logging
    - Geofences (later)
    - Units meters/miles (later)

 - Settings on device
    - Minimal seconds time between movement triggers
      ('do not retrigger for 30 seconds (and so pause polling)')
    - Minimal meters distance between movement triggers
    - Icon (later)

---
#### Changelog
##### 0.0.2
- Added log system on settings screen
- Added flow action 'say location'
##### 0.0.1
- Initial
---
#### TO DO (prioritized)
- Implement start/stop moving trigger and condition cards based on device-setting
- Enhance device-settings
- Bind devices to precense of users
- Put stuff in library's
- Normalize getAddress responses output in location library (or delete wialon backup)
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
