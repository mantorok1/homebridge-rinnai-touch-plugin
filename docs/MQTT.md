# MQTT Client

The plugin is able to operate as an MQTT client. It publishes various topics containing status information which other clients can subscribe to. It also subscribes to topics allowing other clients to send commands to the Rinnai Touch module.

The folowing formats are supported:
* Native Rinnai Touch
* Home Assistant HVAC

## Native Rinnai Touch

|Topic|Type|Payload|
|-|-|-|
|`native/get`|Publish|Full status that is received from the module|
|`native/set`|Subscribe|Command in the format `{Group1: {Group2: {Command: "value"}}}`|

See the [Rinnai Touch Module WiFi API](https://hvac-api-docs.s3.us-east-2.amazonaws.com/NBW2API_Iss1.3.pdf) for more details on the content of the status and allowed commands.

## Home Assistant HVAC

|Topic|Type|Payload|
|-|-|-|
|`ha/action/get`|Publish|Current state of HVAC. Values can be "off", "idle", "heating", "cooling", "fan". Supports zones|
|`ha/current_temperature/get`|Publish|Current temperature. Supports zones|
|`ha/fan_mode/get`|Publish|Fan speed. Values can be "low", "medium", "high"|
|`ha/fan_mode/set`|Subscribe|Set the fan speed. Can be same values as `fan_mode/get`|
|`ha/mode/get`|Publish|Mode of HVAC. Values can be “off”, “cool”, “heat”, “fan_only”|
|`ha/mode/set`|Subscribe|Ste mode of HVAC. Can be same values as `mode/get`|
|`ha/temperature/get`|Publish|Target temperature. Supports zones|
|`ha/temperature/set`|Subscribe|Set target temperature. Supports zones|

The payload is either a string value or a JSON object containing string values for each zone (if the payload supports zones). The JSON object has the following format:

    {A: "value1", B: "value2", ... }

## MQTT Settings

This section describes the configuration options for the plugin to operate as an MQTT client. The following is a sample config:

    "mqtt": {
        "host": "mqtt://localhost",
        "port": 1883,
        "username": "mantorok",
        "password": "password",
        "format": "",
        "topicPrefix": "rinnai",
        "publishCommandProcessed": true,
        "publishStatusChanged": false,
        "publishIntervals": true,
        "publishFrequency": 60
    },

|Option|Description|Default Value (if not supplied)|
|-|-|-|
|`host`|MQTT Broker host name||
|`port`|MQTT Broker port|`1883`|
|`username`|Credentials for MQTT Broker||
|`password`|||
|`topicPrefix`|Optional text to prefix to each topic name|`rinnai`|
|`formatNative`|Enable Native Rinnai Touch message format|`false`|
|`formatHomeAssistant`|Enable Home Assistant HVAC message format|`false`|
|`publishCommandProcessed`|Publish after command processed|`false`|
|`publishStatusChanged`|Publish when status has changed|`false`|
|`publishIntervals`|Publish at regular intervals|`false`|
|`publishFrequency`|Publish frequency (secs)|`60`|