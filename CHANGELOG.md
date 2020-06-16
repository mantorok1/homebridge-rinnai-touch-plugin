# Change Log

All notable changes to this project will be documented in this file.

## 2.4.0 (2020-06-17)

* New MQTT topics & status change publication event
* New config option for IP Address, Port & Connection Timeout
* Add support for Common zone
* Removal of Map Overrides

## 2.3.2 (2020-06-02)

* [FIX] Ignore decimal place when setting temperature via Home Assistant HVAC

## 2.3.1 (2020-06-02)

* Replace Simple MQTT format with Home Assistant HVAC specific one

## 2.3.0 (2020-05-26)

* MQTT support to publish status and subscribe to commands
* Add CHANGELOG file
* Further code cleanup
* Improved error handling and logging

## 2.2.0 (2020-05-17)

* Major code refactor
* New Manual Control switch
* Reintroduce Heater Cooler accessory as alternative to Thermostat accessory
* Show controller's temperature units in "Hardware Display Units" of Thermostat/Heater Cooler accessory
* Expose TCP close connection delay time as configuration option
* Add Config Schema file to allow configuration via Homebridge Config UI X

## 2.1.0 (2020-04-18)

* Set unique serial number for each accessory
* Set fan rotation direction
* Automatically switch fan off when switching HVAC on and vice versa
* Stability improvements when sending commands to WiFi module

## 2.0.0 (2020-04-11)

* New switch accessories for Fan, Pump & Advance Period
* Use Homebridge dynamic platform instead of single accessory
* Use Thermostat service instead of Heater Cooler
* Zero config option
* Better support for evaporative cooling
* Revamped mapping overrides

## 1.2.0 (2020-03-24)

* Better support for multiple controller setups

## 1.1.0 (2020-03-22)

* Automatic detection of HVAC options (add-on air con, evaporative cooling)
* Map overrides configuration
* Partial evaporative cooling support
* Retry TCP connection (useful when router is rebooted and IP address changes)
* Stability improvements

## 1.0.1 (2020-03-15)

* [FIX] Current State and Zones not working for mutli-controller setups

## 1.0.0 (2020-03-15)

* Add single accessory with Heater Cooler & Zone Switch services
