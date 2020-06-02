# Homebridge Plugin for the Rinnai Touch WiFi Module
This Homebridge Plugin allows you to control a Brivis HVAC system via a Rinnai Touch WiFi Module. It supports the following configurations:
* Single controller with 1 or more zones
* Multiple controllers, one per zone

Functions available:
* Displaying the current state of the device
* Switching the device to Off, Heating or Cooling modes
* Displaying the current temperature (depends on controller model)
* Setting the desired temperature
* Switching zones On and Off
* Switching the circulation fan On and Off as well as setting rotation speed
* Turning the water pump On and Off (for Evaporative Cooling only)
* Advancing to the next period of the Programme Schedule. (eg. Leave -> Return)
* Switching between Manual and Schedule control modes
* MQTT client. See [MQTT.md](docs/MQTT.md) for details.

## Accessories

This plugin will add one or more accessories to the Home app depending on your Rinnai Touch status. Accessories are discovered automatically without any need to modify the config.json file. The following table describes each type of accessory.

|Accessory|Description|
|-|-|
|Thermostat / Heater&nbsp;Cooler|Displays the current temperature, units (Celsius or Fahrenheit) and mode of the Brivis HVAC system. It allows you to set the desired temperature and change the mode. Modes are:<ul><li>`OFF` - System is off</li><li>`HEAT` - System is in heating mode</li><li>`COOL` - System is in cooling mode</li><li>`AUTO` - Returns system into Auto mode and the current period of the programme schedule (this option can be hidden with the `showAuto` config option). It will return to the `HEAT` or `COOL` mode when complete</li></ul>NOTES:<ul><li>One accessory will be added for each controller</li><li>Temperature units in the accessory do not determine which unit to use when displaying temperatures in the Home app. This is controlled by your phone's settings</li></ul>|
|Zone Switch|Shows if the zone is currently On or Off and allows you to change it. Zone Switches will be added if you have 1 controller with more than 1 zone|
|Fan|Displays the current state and speed setting of the circulation fan. Allows you to turn it Off or set the rotation speed<br/>NOTE: The fan can only be used when the Thermostat is in the `OFF` mode or `COOL` mode for Evaporative Cooling|
|Pump|Displays the current state of the pump if you have Evaporative Cooling. Allows you to turn it On or Off<br/>NOTE: The pump can only be used when the Thermostat is in `COOL` mode.|
|Advance Period Switch|Shows if the Period of the Programme Schedule has been advanced and allows you to change it|
|Manual Switch|Shows if the Manual mode is On or Off and allows you to change it|

## Installation
Note: This plugin requires homebridge to be installed first.

To install or upgrade to the latest version of this plugin:

    npm install -g homebridge-rinnai-touch-plugin@latest

## Configuration

This is a platform plugin that will register accessories and their services with the Bridge provided by homebridge. It supports up to 4 controllers and 4 zones. The plugin will attempt to discover your Rinnai Touch accessories automatically thus requiring zero configuration to the config.json file.

If you find the auto config is not correct for your system or some defaults are not to your liking there are some overrides you can define in the config.json file.

NOTE: Homebridge version 1.0.0 and onwards require an entry in the config.json file

|Option|Description|Default Value (if not supplied)|
|-|-|-|
|platform|Must be `"RinnaiTouchPlatform"`||
|name|The name of the platform|`"Rinnai Touch"`|
|serviceType|Use the Thermostat or the newer Heater Cooler service.<br/> Options: `"thermostat"` or `"heatercooler"`|`"thermostat"`|
|controllers|The number of controllers.<br/>Options: `1`, `2`, `3` or `4`|Determined by plugin|
|showZoneSwitches|Show the Zone Switch accesories in the Home app|`true` for 1 controller otherwise `false`|
|showFan|Show the fan accessory in the Home app|`true`|
|showAuto|Show the `AUTO` option in the Thermostat menu|`true` for 1 controller otherwise `false`|
|showAdvanceSwitches|Show the Advance Period switch accessory in the Home app|`true` for 1 controller otherwise `false`|
|showManualSwitches|Show the Manual switch accessory in the Home app|`true` for 1 controller otherwise `false`|
|closeConnectionDelay|The time (ms) to wait for the TCP connection to fully close. Increasing this may reduce `Connection Refused` errors from occuring|`1100`|
|clearCache|Clear all the plugin's cached accessories from homebridge to force full discovery of accessories on restart|`false`|
|debug|Output debug information to the Homebridge log|`false`|
|mqtt|See [MQTT.md](docs/MQTT.md) for details|`{}`|
|maps|See [MapOverrides.md](docs/MapOverrides.md) for details|`{}`|

#### Example: Bare mimimum (requried for Homebridge 1.0.0 onwards)

    "platforms": [
        {
            "platform": "RinnaiTouchPlatform"
        }
    ],


#### Example: Single Controller with debug logging

    "platforms": [
        {
            "platform": "RinnaiTouchPlatform",
            "name": "Rinnai Touch",
            "controllers": 1,
            "debug": true
        }
    ],

#### Example: Two Controllers with no Auto, Advance Period & Manual switches
This is useful if you only use Manual Control of your HVAC (ie. no programme schedules).

    "platforms": [
        {
            "platform": "RinnaiTouchPlatform",
            "name": "Rinnai Touch",
            "controllers": 2,
            "showAuto": false,
            "showAdvanceSwitches": false,
            "showManualSwitches": false
        }
    ],

## Version History

See [Change Log](CHANGELOG.md).

## Known Limitations
* The plugin only supports a TCP connection over a LAN so no other connections can be active at the time. This would typically be the TouchApp by Rinnai.
* If the TCP connection is not closed properly then no further connections can be made to the module. I've tried to mitigate this as best I can by keeping TCP connections as short as possible and only allowing one request at a time. If it does happen I find rebooting my router clears it but rebooting the module itself should work also.
* Multi controller and Evaporative cooling configurations were not able to be tested so may not function properly.
* Due to the lag between sending a command to the module and it correctly reflecting that command in it's status there may be a short delay of a few seconds before the Home app shows the correct values. eg. When switching from HEAT to COOL mode some details such as the desired temperature will take a few seconds before the current value is shown.
* If the number of zones is different between the `Heat` and `Cool` modes the Zone Switches are dynamically added or removed as necessary. The downside of this is that you will loose any changes you made to the accessory (eg. name).
* Sometimes when the fan is On and attempting to switch to `Heat` or `Cool` mode the system will switch back to the `Off` state
