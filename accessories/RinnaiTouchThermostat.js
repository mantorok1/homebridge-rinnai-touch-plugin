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

    init(name, status, zone) {
        this.log.debug(this.constructor.name, 'init', name, 'status', zone);
        
        super.init(name, status, zone)

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
        this.updateValues(status);
    }

    getValidCurrentHeatingCoolingStates () {
        this.log.debug(this.constructor.name, 'getValidCurrentHeatingCoolingStates');

        let validStates = [Characteristic.CurrentHeatingCoolingState.OFF];
        if (this.settings.hasHeater) {
            validStates.push(Characteristic.CurrentHeatingCoolingState.HEAT);
        }
        if (this.settings.hasCooler || this.settings.hasEvap) {
            validStates.push(Characteristic.CurrentHeatingCoolingState.COOL);
        }
        return validStates;
    }

    getValidTargetHeatingCoolingStates() {
        this.log.debug(this.constructor.name, 'getValidTargetHeatingCoolingStates');

        let validStates = [Characteristic.TargetHeatingCoolingState.OFF];
        if (this.settings.hasHeater) {
            validStates.push(Characteristic.TargetHeatingCoolingState.HEAT);
        }
        if (this.settings.hasCooler || this.settings.hasEvap) {
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

    getCurrentHeatingCoolingState(status) {
        this.log.debug(this.constructor.name, 'getCurrentHeatingCoolingState', 'status');

        let path = this.map.getPath('Active', status.mode, this.accessory.context.zone);
        let state = status.getState(path);

        if (state === undefined || state === 'N')
            return Characteristic.CurrentHeatingCoolingState.OFF;
        
        if (status.mode === 'HGOM')
            return Characteristic.CurrentHeatingCoolingState.HEAT;

        return Characteristic.CurrentHeatingCoolingState.COOL;
    }

    getTargetHeatingCoolingState(status) {
        this.log.debug(this.constructor.name, 'getTargetHeatingCoolingState', 'status');

        let path = this.map.getPath('State', status.mode);
        let state = status.getState(path);

        if (state === undefined || state !== 'N')
            return Characteristic.TargetHeatingCoolingState.OFF;

        if (status.mode === 'HGOM')
            return Characteristic.TargetHeatingCoolingState.HEAT;
        
        return Characteristic.TargetHeatingCoolingState.COOL;
    }

    getTargetTemperature(status) {
        this.log.debug(this.constructor.name, 'getTargetTemperature', 'status');

        let path = this.map.getPath('TargetTemp', status.mode, this.accessory.context.zone);
        let state = status.getState(path);

        if (state === undefined)
            return null;

        return parseFloat(state);
    }

    setTargetHeatingCoolingState(value, status) {
        this.log.debug(this.constructor.name, 'setTargetHeatingCoolingState', value, 'status');

        let commands = [];

        let currentValue = this.getTargetHeatingCoolingState(status);
        if (currentValue === value)
            return commands;

        let path = undefined;
        let state = undefined;
        let expect = {};

        // If not turning off and fan is on then turn off first
        if (value !== Characteristic.TargetHeatingCoolingState.OFF) {
            path = this.map.getPath('State', status.mode);
            if (status.getState(path) === 'Z') {
                commands.push(this.getCommand(path, 'F'));
            }
        }

        if (currentValue === Characteristic.TargetHeatingCoolingState.OFF) {
            path = this.map.getPath('State', status.mode);
            commands.push(this.getCommand(path, 'N'));
        }

        switch(value) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                path = this.map.getPath('State', status.mode);
                commands.push(this.getCommand(path, 'F'));
                break;
            case Characteristic.TargetHeatingCoolingState.HEAT:
                path = this.map.getPath('Mode');
                expect = {
                    path: this.map.getPath('HeatState'),
                    state: 'N'
                };
                commands.push(this.getCommand(path, 'H', expect));
                break;
            case Characteristic.TargetHeatingCoolingState.COOL:
                path = this.map.getPath('Mode');
                expect = {
                    path: this.map.getPath(this.settings.hasCooler ? 'CoolState' : 'EvapState'),
                    state: 'N'
                };
                commands.push(this.getCommand(path, this.settings.hasCooler ? 'C' : 'E', expect));
                break;
            case Characteristic.TargetHeatingCoolingState.AUTO:
                path = this.map.getPath('Operation', status.mode, this.accessory.context.zone);
                state = status.getState(path);
                if (state !== 'A')
                    commands.push(this.getCommand(path, 'A'));
                path = this.map.getPath('ScheduleState', status.mode, this.accessory.context.zone);
                state = status.getState(path);
                if (state !== 'N')
                    commands.push(this.getCommand(path, 'N'));
                break;
        }

        return commands;
    }

    setTargetTemperature(value, status) {
        this.log.debug(this.constructor.name, 'setTargetTemperature', value, 'status');

        let commands = [];

        let currentValue = this.getTargetTemperature(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('TargetTemp', status.mode, this.accessory.context.zone);
        let state = ('0' + value).slice(-2);
        commands.push(this.getCommand(path, state));
        
        return commands;
    }

    updateValues(status) {
        this.log.debug(this.constructor.name, 'updateValues', 'status');
        
        let service = this.accessory.getService(Service.Thermostat);
        super.updateValues(status, service);

        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .updateValue(this.getCurrentHeatingCoolingState(status));

        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .updateValue(this.getTargetHeatingCoolingState(status));

        service.getCharacteristic(Characteristic.TargetTemperature)
            .updateValue(this.getTargetTemperature(status));
    }
}

module.exports = RinnaiTouchThermostat;