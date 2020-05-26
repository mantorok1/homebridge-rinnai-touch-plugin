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
* MQTT client

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

## MQTT Client

The plugin supports publishing status information at specified intervals as well as subscribing to commands to allow control via other MQTT clients. Two formats of payload are available:
* Native - Rinnai Touch Module status and commands
* Simple - Simpilified status and command based on Homebridge accessory characteristics

### Native Payload

The raw status from the module is published without the sequence number (ie. just the JSON). Commands need to be in the following format:

    {Group1: {Group2: {Command: "value"}}}

See the [Rinnai Touch Module WiFi API](https://hvac-api-docs.s3.us-east-2.amazonaws.com/NBW2API_Iss1.3.pdf) for more details. 

### Simple Payload

The structure of the status information is based on the characteristics of the plugin accessories. The status inforamtion is in one of the following formats depending on if it apply to zones or not:

    Key: Value

    Key: {A: Value1, B: Value2, ... }

Example Status Payload:

    {
        TargetState: "heat",
        CurrentState: "idle",
        TargetTemp: 22,
        CurrentTemp: 22.2,
        ZoneOn: {A: true, B: true },
        ManualOn: false,
        AdvancePeriodOn: false,
        FanOn: false,
        FanSpeed: 50
    }

Commands can be in one of the following formats. Only 1 command is permitted at a time.

    {Key: Value}

    {Key: {A: Value1, B: Value2, ... }}

Example Command Payload:

    {TargetState: "heat"}

The folllowing table describes the contents of the MQTT simple payload.

|Key|Command|Zones|Values|Description|
|-|-|-|-|-|
|TargetState|Yes|Yes|`off`,`heat`,`cool`,`auto`|HVAC mode (`auto` is only applicable for commands)|
|CurrentState|No|Yes|`idle`,`heating`,`cooling`|HVAC state|
|TargetTemp|Yes|Yes|`nn` (8 - 30)|Target Temperature (in Celcius)|
|CurrentTemp|No|Yes|`nn.n`|Current Temperature (in Celcius)|
|ZoneOn|Yes|Yes|`true`,`false`|Zone is on|
|AdvancePeriodOn|Yes|Yes|`true`,`false`|Advance period is on|
|ManualOn|Yes|Yes|`true`,`false`|Manual Operation Control is on|
|FanOn|Yes|No|`true`,`false`|Fan is on|
|FanSpeed|Yes|No|`nnn` (1 - 100)|Fan speed|
|PumpOn|Yes|No|`true`,`false`|Pump is on (for evaporative cooling)|

NOTES:
* `Command` indicates that the key can be used in commands.
* `Zones` indicates that multiple zones are supported.
*  For commands, if specific zones are not defined in the payload then ALL zones are assumed. eg. `{ZoneOn: true}` will turn on all zones.

See **MQTT Settings** section below on how to configure.

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
|mqtt|MQTT settings. See **MQTT Settings** section below|`{}`|
|maps|Map overrides. See **Map Overrides** section below|`{}`|

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

#### Example: Two Controllers with map override & clear cached accessories

    "platforms": [
        {
            "platform": "RinnaiTouchPlatform",
            "name": "Rinnai Touch",
            "controllers": 2,
            "maps": {
                "HeatOperation": "HGOM.Z{zone}O.OP"
            },
            "clearCache": true
        }
    ],

### MQTT Settings

This section describes the configuration options for the plugin to operate as an MQTT client. The following is a sample config:

    "mqtt": {
        "host": "mqtt://localhost",
        "port": 1883,
        "username": "mantorok",
        "password": "password",
        "publishTopic": "RinnaiTouchStatus",
        "subscribeTopic": "RinnaiTouchCommand",
        "publishFrequency": 60,
        "nativePayloads": false
    },

|Option|Description|Default Value (if not supplied)|
|-|-|-|
|host|MQTT Broker host name||
|port|MQTT Broker port|`1883`|
|username|Credentials for MQTT Broker||
|password|||
|publishTopic|Topic name for publishing|`RinnaiTouchStatus`|
|subscribeTopic|Topic name for subscribing|`RinnaiTouchCommand`|
|publishFrequency|How often the status will be published in seconds (0 = don't publish)|`60`|
|nativePayloads|Use the Rinnai Touch WiFi module's native status & commands in payloads|`false`|

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
|`TempUnits`|Get temperature display units|C,F|`SYST.CFG.TU`|
|`HeatState`|Get/Set state [On, Off, Fan]|N,F,Z|`HGOM.OOP.ST`|
|`HeatOperation`|Get/Set Operation [Auto, Manual]|A,M|`HGOM.GSO.OP` for 1 controller<br/>`HGOM.Z{zone}O.OP` for 2+ controllers|
|`HeatSchedulePeriod`|Get current period of schedule [Wake, Leave, Return, Presleep, Sleep]|W,L,R,P,S|`HGOM.GSS.AT`|
|`HeatScheduleState`|Get/Set schedule state [Now, Advance, Override]|N,A,O|`HGOM.GSO.AO` for 1 controller<br/>`HGOM.ZUO.AO` for 2+ controllers|
|`HeatActive`|Is unit actively heating|Y,N|`HGOM.Z{zone}S.AE`|
|`HeatCurrentTemp`|Get current temperature [nn.n degrees]|nnn|`HGOM.Z{zone}S.MT`|
|`HeatTargetTemp`|Get/Set target temperture [nn degrees]|08 - 30|`HGOM.GSO.SP` for 1 controller<br/>`HGOM.Z{zone}O.SP` for 2+ controllers|
|`HeatFanSpeed`|Get/Set the fan's rotation speed [nn]|01 - 16|`HGOM.OOP.FL`|
|`HeatZoneSwitch`|Get/Set zone switch on|Y,N|`HGOM.Z{zone}O.UE`|
|`CoolState`|Get/Set state [On, Off, Fan]|N,F,Z|`CGOM.OOP.ST`|
|`CoolOperation`|Get/Set Operation [Auto, Manual]|A,M|`CGOM.GSO.OP` for 1 controller<br/>`CGOM.Z{zone}O.OP` for 2+ controllers|
|`CoolSchedulePeriod`|Get current period of schedule [Wake, Leave, Return, Presleep, Sleep]|W,L,R,P,S|`CGOM.GSS.AT`|
|`CoolScheduleState`|Get/Set schedule state [Now, Advance, Override]|N,A,O|`CGOM.GSO.AO` for 1 controller<br/>`CGOM.ZUO.AO` for 2+ controllers|
|`CoolActive`|Is unit actively cooling|Y,N|`CGOM.Z{zone}S.AE`|
|`CoolCurrentTemp`|Get current temperature [nn.n degrees]|nnn|`CGOM.Z{zone}S.MT`|
|`CoolTargetTemp`|Get/Set target temperture [nn degrees]|08 - 30|`CGOM.GSO.SP` for 1 controller<br/>`CGOM.Z{zone}O.SP` for 2+ controllers|
|`CoolFanSpeed`|Get/Set the fan's rotation speed [nn]|01 - 16|`CGOM.OOP.FL`|
|`CoolZoneSwitch`|Get/Set zone switch on|Y,N|`CGOM.Z{zone}O.UE`|
|`EvapState`|Get/Set state [On, Off, Fan]|N,F,Z|`ECOM.GSO.SW`|
|`EvapOperation`|Get/Set Operation [Auto, Manual]|A,M|`ECOM.GSO.OP`|
|`EvapSchedulePeriod`|Get current period of schedule [Wake, Leave, Return, Presleep, Sleep]|W,L,R,P,S|`ECOM.GSS.AT`|
|`EvapScheduleState`|Get/Set schedule state [Now, Advance, Override]|N,A,O|`ECOM.GSO.AO`|
|`EvapActive`|Is unit actively cooling|Y,N|`ECOM.GSS.ZUAE`|
|`EvapCurrentTemp`|Get current temperature [nn.n degrees]|nnn|`ECOM.GSS.MT`|
|`EvapFanSpeed`|Get/Set the fan's rotation speed [nn]|01 - 16|`ECOM.GSO.FL`|
|`EvapZoneSwitch`|Get/Set zone switch on|Y,N|`ECOM.GSO.ZUUE`|
|`EvapPump`|Get/Set Evaporative Cooling pump [On, Off]|N,F|`ECOM.GSO.PS`|

where `{zone}` will be replaced by the appropriate zone (ie. A for 1st zone, B for 2nd, etc)

## Version History

See [Change Log](CHANGELOG.md).

## Known Limitations
* The plugin only supports a TCP connection over a LAN so no other connections can be active at the time. This would typically be the TouchApp by Rinnai.
* If the TCP connection is not closed properly then no further connections can be made to the module. I've tried to mitigate this as best I can by keeping TCP connections as short as possible and only allowing one request at a time. If it does happen I find rebooting my router clears it but rebooting the module itself should work also.
* Multi controller and Evaporative cooling configurations were not able to be tested so may not function properly.
* Due to the lag between sending a command to the module and it correctly reflecting that command in it's status there may be a short delay of a few seconds before the Home app shows the correct values. eg. When switching from HEAT to COOL mode some details such as the desired temperature will take a few seconds before the current value is shown.
* If the number of zones is different between the `Heat` and `Cool` modes the Zone Switches are dynamically added or removed as necessary. The downside of this is that you will loose any changes you made to the accessory (eg. name).
* Sometimes when the fan is On and attempting to switch to `Heat` or `Cool` mode the system will switch back to the `Off` state
