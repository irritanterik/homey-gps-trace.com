# GPS-Trace

Track your car and phones with the free GPS-Trace.com service. You can find a list of all supported devices [here](http://gps-trace.com/en/hardware). Mobile phones are trackable with the GPS Tag Orange apps for [Android](https://play.google.com/store/apps/details?id=wialon.GPS_Tag_Orange) and [Apple](https://itunes.apple.com/app/gps-tag-orange/id766356081).
The location of your Homey will be added as a default geofence. Additional geofences can be added.

If you like the app, buy me a beer!  

### Speech triggers, will answer with location:
 - Dude, where is my <car name> (NL: Gast waar is mijn <tracker naam>)
 - GPS <tracker name>

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
      - Enable speech triggers / responses
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
