# Homebridge Plugin for the Rinnai Touch WiFi Module
This Homebridge Plugin allows you to control heating/cooling operations via a Rinnai Touch WiFi Module. It supports the following:
* Displaying the current temperature
* Switching the unit On and Off
* Switching between heating and cooling
* Setting the desired temperate
* Switching Zones On and Off. If you prefer to see the Zones as their own tiles within the Home app you can go into the Rinnai Touch tile's settings and choose "Show as Seperate Tiles"

## Installation
Note: This plugin requires homebridge to be installed first.

    npm install -g homebridge-rinnai-touch-plugin

## Configuration

This is an accessory plugin that will register its services with the Bridge provied by homebridge. The following shows a sample homebridge configuration in the config.json file.

    "accessories": [
        {
            "accessory": "RinnaiHeaterCooler",
            "name": "Rinnai Touch",
            "hasHeater": true,
            "hasCooler": true,
            "zones": {
                "A": "Bedrooms",
                "B": "Living Areas"
            },
            "initialHeatTemp": 22,
            "initialCoolTemp": 27,
            "debug": true
        }
    ],

The following describes the available config options
|Option|Description|Default Value (if not supplied)|
|-|-|-|
|accessory|Must be "RinnaiHeaterCooler"||
|name|The name that will appear on the Home tile||
|hasHeater|Does the unit control a heater (1)|true|
|hasCooler|Does the unit control a cooler (1)|true|
|zones|The zones supported by the unit. Zones A to D with their names can be defined (1)|{} (ie. no zones)|
|initialHeatTemp|The default Heating Temperate (2)|22|
|initialCoolTemp|The default Cooling Temperate (2)|27|
|debug|Output debug information to the Homebridge log|false|

(1) Ideally these should be obtained from the modules status information but I was unable to figure out a way to do this before the plugin's services are defined.

(2) These are for display purposes only. They are there to overcome a deficiency when switching between Heat/Cool modes for the first time. The module only returns either the heating or cooling status so the plugin doesn't know what the other mode's temperature should be until it's had a chance to do an update.

## Known Limitations
* This is my first time writing a Homebridge Plugin so there may be bugs.
* The plugin only supports a TCP connection over a LAN so no other connections can be active at the time. This would typically be the TouchApp by Rinnai.
* If the TCP connection is not closed properly then no further connections can be made to the module. I've tried to mitigate this as best I can by keeping TCP connections as short as possible and only only allowing one request at a time. If it does happen I find rebooting my router clears it but rebooting the module itself should work also.
* Evaporative cooling is not supported
* When switching modes the current status displayed in the Home app may not be accurate as it hasn't been fully updated yet. Closing the app and reopening will force an update.

