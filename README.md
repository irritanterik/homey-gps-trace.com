# GPS-Trace

Track your car and phones with the free GPS-Trace.com service. The location of
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
 - Say location of tracker (later)

## settings
 - General settings
    - Account details
    - Enable polling
    - Geofences (later)
    - Units meters/miles (later)

 - Settings on device
    - Polling interval (0 = no polling at all)
    - Minimal seconds time between movement triggers
      ('do not retrigger for 30 seconds (and so pause polling)')
    - Minimal meters distance between movement triggers
    - Icon (later)

# TO DO:
 - Enhance device-settings
 - Bind tracking to devices with enabled polling
 - Bind devices to precense of users 
 - Put stuff in library's
 - Normalize getAddress responses output (or delete wialon backup)
 - Warn on account removal about ghost devices
 - Get and save tracker hw-type and hw-category
 - Select an icon on device addition
 - Add API:
    - PUT new positions for a tracker
    - GET position and address for a tracker
 - Units selections meters/miles
 - Do account config on first device addition if it's not done yet.
