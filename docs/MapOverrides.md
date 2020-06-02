# Map Overrides
After releasing the first version of this plugin some have encountered issues as their modules show a different status structure to my own one. Zones in particular seem to be implemented in many ways. Using the status from other people's system (thanks mitchmario & FrontBottom) I've tried to cater to as many combinations as possible.

However, if it doesn't work fully for your system I've introduced a way to override the mapping between HomeKit and the Rinnai Touch.

WARNING: This section is a bit technical and not for the faint hearted.

## Configuration

Example override:

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
