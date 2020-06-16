const RinnaiTouchTemperature = require('./RinnaiTouchTemperature');

let Accessory, Service, Characteristic, UUIDGen;

class RinnaiTouchThermostat extends RinnaiTouchTemperature {
    constructor(platform) {
        super(platform);
        this.log.debug(this.constructor.name, undefined, 'platform');

        this.name = 'Thermostat';

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    init(name, zone) {
        this.log.debug(this.constructor.name, 'init', name, zone);
        
        super.init(name, zone)

        let service = this.accessory.addService(Service.Thermostat, name);

        let validStates = this.getValidCurrentHeatingCoolingStates();
        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .setProps({
                minValue: Math.min(...validStates),
                maxValue: Math.max(...validStates),
                validValues: validStates
            });

        validStates = this.getValidTargetHeatingCoolingStates();
        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .setProps({
                minValue: Math.min(...validStates),
                maxValue: Math.max(...validStates),
                validValues: validStates
            });

        service.getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minValue: 8,
                maxValue: 30,
                minStep: 1
            });

        this.setEventHandlers();
        this.updateValues();
    }

    getValidCurrentHeatingCoolingStates () {
        this.log.debug(this.constructor.name, 'getValidCurrentHeatingCoolingStates');

        let validStates = [Characteristic.CurrentHeatingCoolingState.OFF];
        if (this.service.hasHeater) {
            validStates.push(Characteristic.CurrentHeatingCoolingState.HEAT);
        }
        if (this.service.hasCooler || this.service.hasEvaporative) {
            validStates.push(Characteristic.CurrentHeatingCoolingState.COOL);
        }
        return validStates;
    }

    getValidTargetHeatingCoolingStates() {
        this.log.debug(this.constructor.name, 'getValidTargetHeatingCoolingStates');

        let validStates = [Characteristic.TargetHeatingCoolingState.OFF];
        if (this.service.hasHeater) {
            validStates.push(Characteristic.TargetHeatingCoolingState.HEAT);
        }
        if (this.service.hasCooler || this.service.hasEvaporative) {
            validStates.push(Characteristic.TargetHeatingCoolingState.COOL);
        }
        if (this.settings.showAuto) {
            validStates.push(Characteristic.TargetHeatingCoolingState.AUTO);
        }

        return validStates;
    }

    setEventHandlers() {
        this.log.debug(this.constructor.name, 'setEventHandlers');

        let service = this.accessory.getService(Service.Thermostat);
        super.setEventHandlers(service);

        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCharacteristicValue.bind(this, this.getCurrentHeatingCoolingState.bind(this)));

        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('get', this.getCharacteristicValue.bind(this, this.getTargetHeatingCoolingState.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setTargetHeatingCoolingState.bind(this)));

        service.getCharacteristic(Characteristic.TargetTemperature)
            .on('get', this.getCharacteristicValue.bind(this, this.getTargetTemperature.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setTargetTemperature.bind(this)));
    }

    getCurrentHeatingCoolingState() {
        this.log.debug(this.constructor.name, 'getCurrentHeatingCoolingState');

        let state = this.service.getSystemActive(this.accessory.context.zone);

        if (!state) {
            return Characteristic.CurrentHeatingCoolingState.OFF;
        }
        
        if (this.service.mode === this.service.Modes.HEAT) {
            return Characteristic.CurrentHeatingCoolingState.HEAT;
        }

        return Characteristic.CurrentHeatingCoolingState.COOL;
    }

    getTargetHeatingCoolingState() {
        this.log.debug(this.constructor.name, 'getTargetHeatingCoolingState');

        let state = this.service.getState();

        if (!state) {
            return Characteristic.TargetHeatingCoolingState.OFF;
        }

        if (this.service.mode === this.service.Modes.HEAT) {
            return Characteristic.TargetHeatingCoolingState.HEAT;
        }
             
        return Characteristic.TargetHeatingCoolingState.COOL;
    }

    getTargetTemperature() {
        this.log.debug(this.constructor.name, 'getTargetTemperature');

        return this.service.getTargetTemperature(this.accessory.context.zone);
    }

    async setTargetHeatingCoolingState(value) {
        this.log.debug(this.constructor.name, 'setTargetHeatingCoolingState', value);

        if (this.service.getFanState() && value === Characteristic.TargetHeatingCoolingState.OFF) {
            return;
        }
        
        if (value === Characteristic.TargetHeatingCoolingState.OFF) {
            await this.service.setState(false);
            return;
        }

        if (this.service.getFanState()) {
            await this.service.setFanState(false);
        }

        if (value === Characteristic.TargetHeatingCoolingState.HEAT) {
            await this.service.setMode(this.service.Modes.HEAT);
            await this.service.setState(true);
            return;
        }

        if (value === Characteristic.TargetHeatingCoolingState.COOL) {
            if (this.service.hasCooler) {
                await this.service.setMode(this.service.Modes.COOL);
            } else {
                await this.service.setMode(this.service.Modes.EVAP);
            }
            await this.service.setState(true);
            return;
        }

        if (value === Characteristic.TargetHeatingCoolingState.AUTO) {
            await this.service.setState(true);
            await this.service.setControlMode(this.service.ControlModes.SCHEDULE, this.accessory.context.zone);
            await this.service.setScheduleOverride(this.service.ScheduleOverrideModes.NONE, this.accessory.context.zone);
            // Force update values so mode switches back to correct mode
            setTimeout(this.updateValues.bind(this), 1000);
        }
    }

    async setTargetTemperature(value) {
        this.log.debug(this.constructor.name, 'setTargetTemperature', value);

        if (this.getTargetTemperature() === value) {
            return;
        }

        await this.service.setTargetTemperature(value, this.accessory.context.zone);
    }

    updateValues() {
        this.log.debug(this.constructor.name, 'updateValues');
        
        let service = this.accessory.getService(Service.Thermostat);
        super.updateValues(service);

        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .updateValue(this.getCurrentHeatingCoolingState());

        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .updateValue(this.getTargetHeatingCoolingState());

        service.getCharacteristic(Characteristic.TargetTemperature)
            .updateValue(this.getTargetTemperature());
    }
}

module.exports = RinnaiTouchThermostat;