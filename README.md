# Homebridge Plugin for the Rinnai Touch WiFi Module
This Homebridge Plugin allows you to control heating/cooling operations via a Rinnai Touch WiFi Module. It supports the following:
* Displaying the current temperature
* Switching the unit On and Off
* Switching between heating and cooling
* Setting the desired temperate
* Switching Zones On and Off. If you prefer to see the Zones as their own tiles within the Home app you can go into the Rinnai Touch tile's settings and choose "Show as Seperate Tiles"

## Installation
Note: This plugin requires homebridge to be installed first.

To install for the first time:

    npm install -g homebridge-rinnai-touch-plugin

To upgrade the already installed plugin:

    npm update -g homebridge-rinnai-touch-plugin

## Configuration

This is an accessory plugin that will register its services with the Bridge provied by homebridge. The following shows a sample homebridge configuration in the config.json file.

    "accessories": [
        {
            "accessory": "RinnaiHeaterCooler",
            "name": "Rinnai Touch",
            "zones": {
                "A": "Bedrooms",
                "B": "Living Areas"
            },
            "map": {},
            "refresh": 60,
            "debug": true
        }
    ],

The following describes the available config options
|Option|Description|Default Value (if not supplied)|
|-|-|-|
|accessory|Must be "RinnaiHeaterCooler"||
|name|The name that will appear on the Home tile|Rinnai Touch|
|zones|The zones supported by the unit. Zones A to D with their names can be defined (1)|{} (ie. no zones)|
|map|Map overrides to support other heater/cooler configurations that are different to mine. See 'Map Overrides' section below|{} (ie. no overrides|
|refresh|The interval (in seconds) that the details of the Rinnai Touch will be refreshed. NOTE: I don't recommend using this but if this is important to you it's there|undefined (ie. no refreshes)|
|debug|Output debug information to the Homebridge log|false|
|hasHeater|[DEPRECATED in 1.1.0] Does the unit control a heater (1)|true|
|hasCooler|[DEPRECATED in 1.1.0] Does the unit control a cooler (1)|true|
|initialHeatTemp|[DEPRECATED in 1.1.0] The default Heating Temperate (2)|22|
|initialCoolTemp|[DEPRECATED in 1.1.0] The default Cooling Temperate (2)|27|


(1) Ideally these should be obtained from the modules status information but I was unable to figure out a way to do this before the plugin's services are defined.

(2) These are for display purposes only. They are there to overcome a deficiency when switching between Heat/Cool modes for the first time. The module only returns either the heating or cooling status so the plugin doesn't know what the other mode's temperature should be until it's had a chance to do an update.

### Map Overrides
After releasing the first version of this plugin some have encountered issues as their modules show a different status structure to my own one. Zones in particular seem to be implemented in many ways. To overcome this I've introduced a way to override the mapping between the HomeKit characteristic and the equivalent Rinnai state (so it's not so specific to mine). I think this may also allow partial control of evaporative cooling systems.

WARNING: This section is a bit technical and not for the faint hearted.

Here's an example of a map override:

    "map": {
        "heat": {
            "HeaterCooler_CurrentHeaterCoolerState": []
        },
        "cool": {
            "HeaterCooler_CoolingThresholdTemperature": [1, "CGOM", "ZUO", "SP"],
            "SwitchZoneA_On": [1, "CGOM", "ZAS", "ID"],
            "SwitchZoneB_On": [1, "CGOM", "ZBS", "ID"]
        }
    },

The characteristics are grouped into the 2 supported modes: "heat" and "cool"<br/>
The key name (eg. "SwitchZoneA_On") represents the HomeKit characteristic.<br/>
The array value (eg. [1, "CGOM", "ZAS", "ID"]) identifies where in the Rinnai status JSON blob to find the corresponding value. In the example it means the 2nd array element in the status (it's 0 based) and then the value in CGOM.ZAS.ID.<br/>
An empty array (ie. []) indicates no mapping exists so a suitable default value will be used if possible.

The following table lists all the characteristics that are supported:

|Mode|Characteristic|Description|Supported Values|Default|
|-|-|-|-|-|
|heat|HeaterCooler_Active|Get/Set power state [N=On,F=Off]|N,F|[1,"HGOM","OOP","ST"]|
|heat|HeaterCooler_CurrentHeaterCoolerState|Get current cooler state|Y,N|[1,"HGOM","GSS","HC"]|
|heat|HeaterCooler_TargetHeaterCoolerState|Get/Set mode [H=Heat,C=Cool,E=Evap]|H,C,E|[0,"SYST","OSS","MD"]|
|heat|HeaterCooler_CurrentTemperature|Get current temp [nn=digits]|nn|[1,"HGOM","ZUS","MT"]|
|heat|HeaterCooler_HeatingThresholdTemperature|Get/Set desired temp [nn=digits]|nn|[1,"HGOM","GSO","SP"]|
|heat|SwitchZoneA_On"|Get/Set Zone A on/off|Y,N|[1,"HGOM","ZAO","UE"]|
|heat|SwitchZoneB_On"|Get/Set Zone B on/off|Y,N|[1,"HGOM","ZBO","UE"]|
|heat|SwitchZoneC_On"|Get/Set Zone C on/off|Y,N|[1,"HGOM","ZCO","UE"]|
|heat|SwitchZoneD_On"|Get/Set Zone D on/off|Y,N|[1,"HGOM","ZDO","UE"]|
|cool|HeaterCooler_Active|Get/Set power state [N=On,F=Off]|N,F|[1,"CGOM","OOP","ST"]|
|cool|HeaterCooler_CurrentHeaterCoolerState|Get current cooler state|Y,N|[1,"CGOM","GSS","CC"]|
|cool|HeaterCooler_TargetHeaterCoolerState|Get/Set mode [H=Heat,C=Cool,E=Evap]|H,C,E|[0,"SYST","OSS","MD"]|
|cool|HeaterCooler_CurrentTemperature|Get current temp [nn=digits]|nn|[1,"CGOM","ZUS","MT"]|
|cool|HeaterCooler_CoolingThresholdTemperature|Get/Set desired temp [nn=digits]|nn|[1,"CGOM","GSO","SP"]|
|cool|SwitchZoneA_On"|Get/Set Zone A on/off|Y,N|[1,"CGOM","ZAO","UE"]|
|cool|SwitchZoneB_On"|Get/Set Zone B on/off|Y,N|[1,"CGOM","ZBO","UE"]|
|cool|SwitchZoneC_On"|Get/Set Zone C on/off|Y,N|[1,"CGOM","ZCO","UE"]|
|cool|SwitchZoneD_On"|Get/Set Zone D on/off|Y,N|[1,"CGOM","ZDO","UE"]|

#### Evaporative Cooling Override

The following is a sample map override which I think will work with an Evaporative Cooling system. This is based on a sample Rinnai status I was given. I have no way to test if this works.

    "map": {
        "cool": {
            "HeaterCooler_Active": [1, "ECOM", "GSO", "SW"],
            "HeaterCooler_CurrentHeaterCoolerState": [1, "ECOM", "GSS", "BY"],
            "HeaterCooler_CurrentTemperature": [],
            "HeaterCooler_CoolingThresholdTemperature": [],
            "SwitchZoneA_On": [1, "ECOM", "GSO", "ZAUE"],
            "SwitchZoneB_On": [1, "ECOM", "GSO", "ZBUE"]
        }
    },

## Version History
|Version|Description|
|-|-|
|1.1.0|<ul><li>Automatic detection of heater/cooler</li><li>Map overrides (see 'Map Overrides' section)</li><li>Scheduled refreshes</li><li>Partial evaporative cooling support</li><li>Retry TCP connection (useful when router is rebooted and IP address changes)</li><li>Stability improvements</li></ul>|
|1.0.1|<ul><li>Fixed bugs with Current State and Zones</li></ul>|
|1.0.0|<ul><li>Initial version</li></ul>|

## Known Limitations
* This is my first time writing a Homebridge Plugin so there may be bugs.
* The plugin only supports a TCP connection over a LAN so no other connections can be active at the time. This would typically be the TouchApp by Rinnai.
* If the TCP connection is not closed properly then no further connections can be made to the module. I've tried to mitigate this as best I can by keeping TCP connections as short as possible and only allowing one request at a time. If it does happen I find rebooting my router clears it but rebooting the module itself should work also.
* Evaporative cooling is only partially supported (maybe?). It should be able to turn on/off, switch between heating/cooling and indicate if unit is actively cooling. It requires map overrides to be defined.
* Due to the lag between sending a command to the module and it correctly reflecting that command in it's status there is a delay of a few seconds before the Home app shows the correct values. eg. When switching from HEAT to COOL mode some details such as the desired temperature will take a few seconds before the current value is shown.

