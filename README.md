# Homebridge Plugin for the Rinnai Touch WiFi Module
This Homebridge Plugin allows you to control heating/cooling operations via a Rinnai Touch WiFi Module. It supports the following configurations:
* Single controller with 1 or more zones
* Multiple controllers, one per zone

Functions available:
* Displaying the current state of the device
* Switching the device to Off, Heating or Cooling modes
* Displaying the current temperature
* Setting the desired temperature
* Switching zones On and Off
* Switching the circulation fan On and Off as well as setting rotation speed
* Turning the water pump On and Off (for Evaporative Cooling only)
* Advancing to the next period of the Programme Schedule. (eg. Leave -> Return)

## Overview

This plugin will add one or more accessories to the Home app depending on your Rinnai Touch status. Accessories are discovered automatically without any need to modify the config.json file. The following table describes each type of accessory.

|Accessory|Description|
|-|-|
|Thermostat|Displays the current temperature and mode the system is in. It allows you to set the desired temperature and change the mode. Modes are:<ul><li>`OFF` - System is off</li><li>`HEAT` - System is in heating mode</li><li>`COOL` - System is in cooling mode</li><li>`AUTO` - Returns system into Auto mode and the current period of the programme schedule (this option can be hidden with the `showAuto` config option). It will return to the `HEAT` or `COOL` mode when complete</li></ul>NOTE: One thermostat accessory will be added for each controller|
|Zone Switch|Displays if the zone is currently On or Off and allows you to change it. Zone Switches will be added if you have 1 controller with more than 1 zone|
|Fan|Displays the current state and speed setting of the circulation fan. Allows you to turn it Off or set the rotation speed<br/>NOTE: The fan can only be used when the Thermostat is in the `OFF` mode or `COOL` mode for Evaporative Cooling|
|Pump|Displays the current state of the pump if you have Evaporative Cooling. Allows you to turn it On or Off<br/>NOTE: The pump can only be used when the Thermostat is in `COOL` mode.|
|Advance Period Switch|Displays if the Period of the Programme Schedule has been advanced and allows you to change it<br/>NOTE: Only available for systems with a single controller|

## Installation
Note: This plugin requires homebridge to be installed first.

To install or upgrade to the latest version of this plugin:

    npm install -g homebridge-rinnai-touch-plugin@latest

## Configuration

This is a platform plugin that will register accessories and their services with the Bridge provied by homebridge. It supports up to 4 controllers and 4 zones. The plugin will attempt to discover your Rinnai Touch accessories automatically thus requiring zero configuration to the config.json file.

If you find the auto config is not correct for your system or some defaults are not to your liking there are some overrides you can define in the config.json file.

|Option|Description|Default Value (if not supplied)|
|-|-|-|
|platform|Must be "RinnaiTouchPlatform"||
|name|The name of the platform|Rinnai Touch|
|controllers|The number of controllers|Determined by plugin|
|maps|Map overides. See Map Overides section below|{}|
|showZoneSwitches|Show the Zone Switch accesories in the Home app|true|
|showAuto|Show the `AUTO` option in the Thermostat menu|true|
|showFan|Show the fan accessory in the Home app|true|
|showAdvanceSwitch|Show the Advance Period switch accessory in the Home app|true|
|refresh|The interval (in seconds) that the details of the Rinnai Touch will be refreshed. NOTE: I don't recommend using this but if this is important to you it's there|undefined (ie. no refreshes)|
|clearCache|Clear all the plugin's cached accessories from homebridge to force full discovery of accessories on restart|false|
|debug|Output debug information to the Homebridge log|false|

#### Example: Single Controller with debug logging

    "platforms": [
        {
            "platform": "RinnaiTouchPlatform",
            "name": "Rinnai Touch",
            "controllers": 1,
            "debug": true
        }
    ],

#### Example: Two Controllers with map override, refresh every 60 secs & clear cached accessories

    "platforms": [
        {
            "platform": "RinnaiTouchPlatform",
            "name": "Rinnai Touch",
            "controllers": 2,
            "maps": {
                "HeatOperation": "HGOM.Z{zone}O.OP"
            },
            "refresh": 60,
            "clearCache": true
        }
    ],

### Map Overrides
After releasing the first version of this plugin some have encountered issues as their modules show a different status structure to my own one. Zones in particular seem to be implemented in many ways. Using the status from other people's system (thanks mitchmario & FrontBottom) I've tried to cater to as many combinations as possible.

However, if it doesn't work fully for your system I've introduced a way to override the mapping between the HomeKit and the Rinnai Touch.

WARNING: This section is a bit technical and not for the faint hearted.

Here's an example of a map override:

    "maps": {
        "HeatOperation": "HGOM.Z{zone}O.OP",
        "CoolOperation": "CGOM.Z{zone}O.OP"
    },


The key name (eg. `HeatOperation`) is used by the plugin to identify the type of status/command.<br/>
The string value (eg. `HGOM.Z{zone}O.OP`) identifies where in the Rinnai status JSON blob to get/set the value. There is a special placeholder named {zone} which the plugin will replace by the appropriate letter corresponding to a zone (ie. A, B, C or D).<br/>
In the example it means `HGOM.ZAO.OP` for Zone A, `HGOM.ZBO.OP` for Zone B and so on.<br/>

The following table lists all the keys that are supported:

|Key|Description|Supported Values|Default|
|-|-|-|-|
|`Mode`|Get/Set mode [Heating, Cooling, Evaporative]|H,C,E|`SYST.OSS.MD`|
|`HeatState`|Get/Set state [On, Off, Fan]|N,F,Z|`HGOM.OOP.ST`|
|`HeatOperation`|Get/Set Operation [Auto, Manual]|A,M|`HGOM.GSO.OP` for 1 controller<br/>`HGOM.Z{zone}O.OP` for 2+ controllers|
|`HeatScheduledPeriod`|Get/Set scheduled period [Now, Advance, Override]|N,A,O|`HGOM.GSO.AO` for 1 controller<br/>`HGOM.ZUO.AO` for 2+ controllers|
|`HeatActive`|Is unit actively heating|Y,N|`HGOM.Z{zone}S.AE`|
|`HeatCurrentTemp`|Get current temperature [nn.n degrees]|nnn|`HGOM.Z{zone}S.MT`|
|`HeatTargetTemp`|Get/Set target temperture [nn degrees]|08 - 30|`HGOM.GSO.SP` for 1 controller<br/>`HGOM.Z{zone}O.SP` for 2+ controllers|
|`HeatFanSpeed`|Get/Set the fan's rotation speed [nn]|01 - 16|`HGOM.OOP.FL`|
|`HeatZoneSwitch`|Get/Set zone switch on|Y,N|`HGOM.Z{zone}O.UE`|
|`CoolState`|Get/Set state [On, Off, Fan]|N,F,Z|`CGOM.OOP.ST`|
|`CoolOperation`|Get/Set Operation [Auto, Manual]|A,M|`CGOM.GSO.OP` for 1 controller<br/>`CGOM.Z{zone}O.OP` for 2+ controllers|
|`CoolScheduledPeriod`|Get/Set scheduled period [Now, Advance, Override]|N,A,O|`CGOM.GSO.AO` for 1 controller<br/>`CGOM.ZUO.AO` for 2+ controllers|
|`CoolActive`|Is unit actively cooling|Y,N|`CGOM.Z{zone}S.AE`|
|`CoolCurrentTemp`|Get current temperature [nn.n degrees]|nnn|`CGOM.Z{zone}S.MT`|
|`CoolTargetTemp`|Get/Set target temperture [nn degrees]|08 - 30|`CGOM.GSO.SP` for 1 controller<br/>`CGOM.Z{zone}O.SP` for 2+ controllers|
|`CoolFanSpeed`|Get/Set the fan's rotation speed [nn]|01 - 16|`CGOM.OOP.FL`|
|`CoolZoneSwitch`|Get/Set zone switch on|Y,N|`CGOM.Z{zone}O.UE`|
|`EvapState`|Get/Set state [On, Off, Fan]|N,F,Z|`ECOM.GSO.SW`|
|`EvapOperation`|Get/Set Operation [Auto, Manual]|A,M|`ECOM.GSO.OP`|
|`EvapScheduledPeriod`|Get/Set scheduled period [Now, Advance, Override]|N,A,O|`ECOM.GSO.AO`|
|`EvapActive`|Is unit actively cooling|Y,N|`ECOM.GSS.ZUAE`|
|`EvapCurrentTemp`|Get current temperature [nn.n degrees]|nnn|`ECOM.GSS.MT`|
|`EvapFanSpeed`|Get/Set the fan's rotation speed [nn]|01 - 16|`ECOM.GSO.FL`|
|`EvapZoneSwitch`|Get/Set zone switch on|Y,N|`ECOM.GSO.ZUUE`|
|`EvapPump`|Get/Set Evaporative Cooling pump [On, Off]|N,F|`ECOM.GSO.PS`|



where `{zone}` will be replaced by the appropriate zone (ie. A for 1st zone, B for 2nd, etc)

## Version History
|Version|Description|
|-|-|
|2.1.0|<ul><li>Added unique serial number for each accessory</li><li>Set fan rotation direction</li><li>Automatically switch fan off when switching Heater/Cooler on and vice versa</li><li>Stability improvements when sending commands to WiFi module</li><li>Remove Advance Period switch for systems with multiple controllers</li></ul>|
|2.0.0|<ul><li>Added new accessories for Fan, Pump & Advance Period switch</li><li>Use Homebridge dynamic platform instead of single accessory</li><li>Use Thermostat service instead of HeaterCooler</li><li>Zero config option</li><li>Better support for evaporative cooling</li><li>Revamped mapping overrides</li></ul>|
|1.2.0|<ul><li>Support for multiple controllers</li></ul>|
|1.1.0|<ul><li>Automatic detection of heater/cooler</li><li>Map overrides (see 'Map Overrides' section)</li><li>Scheduled refreshes</li><li>Partial evaporative cooling support</li><li>Retry TCP connection (useful when router is rebooted and IP address changes)</li><li>Stability improvements</li></ul>|
|1.0.1|<ul><li>Fixed bugs with Current State and Zones</li></ul>|
|1.0.0|<ul><li>Initial version</li></ul>|

## Known Limitations
* The plugin only supports a TCP connection over a LAN so no other connections can be active at the time. This would typically be the TouchApp by Rinnai.
* If the TCP connection is not closed properly then no further connections can be made to the module. I've tried to mitigate this as best I can by keeping TCP connections as short as possible and only allowing one request at a time. If it does happen I find rebooting my router clears it but rebooting the module itself should work also.
* Evaporative cooling mode was not able to be tested so may not function properly.
* Due to the lag between sending a command to the module and it correctly reflecting that command in it's status there is a delay of a few seconds before the Home app shows the correct values. eg. When switching from HEAT to COOL mode some details such as the desired temperature will take a few seconds before the current value is shown.
* If the number of zones is different between the `Heat` and `Cool` modes the Zone Switches are dynamically added or removed as necessary. The downside of this is that you will loose any changes you made to the accessory (eg. name).
* Sometimes when fan is On and attempting to switch to `Heat` or `Cool` mode the system will switch back to the `Off` state
