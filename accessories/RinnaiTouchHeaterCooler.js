const RinnaiTouchTemperature = require('./RinnaiTouchTemperature');

let Accessory, Service, Characteristic, UUIDGen;

class RinnaiTouchHeaterCooler extends RinnaiTouchTemperature {
    constructor(platform) {
        super(platform);
        this.debug(this.constructor.name, undefined, 'platform');

        this.name = 'HeaterCooler';

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    init(name, status, zone) {
        this.debug(this.constructor.name, 'init', name, 'status', zone);
        
        super.init(name, status, zone)

        let service = this.accessory.addService(Service.HeaterCooler, name);

        let validStates = this.getValidCurrentHeaterCoolerStates();
        service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .setProps({
                minValue: Math.min(...validStates),
                maxValue: Math.max(...validStates),
                validValues: validStates
            });

        validStates = this.getValidTargetHeaterCoolerStates();
        service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                minValue: Math.min(...validStates),
                maxValue: Math.max(...validStates),
                validValues: validStates
            });

        service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: 8,
                maxValue: 30,
                minStep: 1
            });

        service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: 8,
                maxValue: 30,
                minStep: 1
            });

        this.setEventHandlers();
        this.updateValues(status);
    }

    getValidCurrentHeaterCoolerStates () {
        this.debug(this.constructor.name, 'getValidCurrentHeaterCoolerStates');

        let validStates = [Characteristic.CurrentHeaterCoolerState.IDLE];
        if (this.config.hasHeater) {
            validStates.push(Characteristic.CurrentHeaterCoolerState.HEATING);
        }
        if (this.config.hasCooler || this.config.hasEvap) {
            validStates.push(Characteristic.CurrentHeaterCoolerState.COOLING);
        }
        return validStates;
    }

    getValidTargetHeaterCoolerStates() {
        this.debug(this.constructor.name, 'getValidTargetHeaterCoolerStates');

        let validStates = [];
        if (this.showAuto) {
            validStates.push(Characteristic.TargetHeaterCoolerState.AUTO);
        }
        if (this.config.hasHeater) {
            validStates.push(Characteristic.TargetHeaterCoolerState.HEAT);
        }
        if (this.config.hasCooler || this.config.hasEvap) {
            validStates.push(Characteristic.TargetHeaterCoolerState.COOL);
        }

        return validStates;
    }

    setEventHandlers() {
        this.debug(this.constructor.name, 'setEventHandlers');

        let service = this.accessory.getService(Service.HeaterCooler);
        super.setEventHandlers(service);

        service.getCharacteristic(Characteristic.Active)
            .on('get', this.getCharacteristicValue.bind(this, this.getActive.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setActive.bind(this)));

        service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .on('get', this.getCharacteristicValue.bind(this, this.getCurrentHeaterCoolerState.bind(this)));

        service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .on('get', this.getCharacteristicValue.bind(this, this.getTargetHeaterCoolerState.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setTargetHeaterCoolerState.bind(this)));

        service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .on('get', this.getCharacteristicValue.bind(this, this.getThresholdTemperature.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setThresholdTemperature.bind(this)));

        service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .on('get', this.getCharacteristicValue.bind(this, this.getThresholdTemperature.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setThresholdTemperature.bind(this)));
    }

    getActive(status) {
        this.debug(this.constructor.name, 'getActive', 'status');

        let path = this.map.getPath('State', status.mode);
        let state = status.getState(path);

        if (state === undefined || state !== 'N')
            return Characteristic.Active.INACTIVE;

        return Characteristic.Active.ACTIVE;
    }

    getCurrentHeaterCoolerState(status) {
        this.debug(this.constructor.name, 'getCurrentHeaterCoolerState', 'status');

        let path = this.map.getPath('Active', status.mode, this.accessory.context.zone);
        let state = status.getState(path);

        if (state === undefined || state === 'N')
            return Characteristic.CurrentHeaterCoolerState.IDLE;
        
        if (status.mode === 'HGOM')
            return Characteristic.CurrentHeaterCoolerState.HEATING;

        return Characteristic.CurrentHeaterCoolerState.COOLING;
    }

    getTargetHeaterCoolerState(status) {
        this.debug(this.constructor.name, 'getTargetHeaterCoolerState', 'status');

        if (status.mode === 'HGOM')
            return Characteristic.TargetHeaterCoolerState.HEAT;
        
        return Characteristic.TargetHeaterCoolerState.COOL;
    }

    getThresholdTemperature(status) {
        this.debug(this.constructor.name, 'getThresholdTemperature', 'status');

        let path = this.map.getPath('TargetTemp', status.mode, this.accessory.context.zone);
        let state = status.getState(path);

        if (state === undefined)
            return null;

        return parseFloat(state);
    }

    setActive(value, status) {
        this.debug(this.constructor.name, 'setActive', value, 'status');

        let commands = [];

        let currentValue = this.getActive(status);
        if (currentValue === value)
            return commands;

        let path;

        // If turning on and fan is on then turn off first
        if (value === Characteristic.Active.ACTIVE) {
            path = this.map.getPath('State', status.mode);
            if (status.getState(path) === 'Z') {
                commands.push(this.getCommand(path, 'F'));
            }
        }

        path = this.map.getPath('State', status.mode);
        let state = value === Characteristic.Active.ACTIVE ? 'N' : 'F';
        commands.push(this.getCommand(path, state));

        return commands;
    }

    setTargetHeaterCoolerState(value, status) {
        this.debug(this.constructor.name, 'setTargetHeaterCoolerState', value, 'status');

        let commands = [];

        let currentValue = this.getTargetHeaterCoolerState(status);
        if (currentValue === value)
            return commands;

        let path;
        let state;
        let expect = {};

        switch(value) {
            case Characteristic.TargetHeaterCoolerState.HEAT:
                path = this.map.getPath('Mode');
                expect = {
                    path: this.map.getPath('HeatState'),
                    state: 'N'
                };
                commands.push(this.getCommand(path, 'H', expect));
                break;
            case Characteristic.TargetHeaterCoolerState.COOL:
                path = this.map.getPath('Mode');
                expect = {
                    path: this.map.getPath(this.config.hasCooler ? 'CoolState' : 'EvapState'),
                    state: 'N'
                };
                commands.push(this.getCommand(path, this.config.hasCooler ? 'C' : 'E', expect));
                break;
            case Characteristic.TargetHeaterCoolerState.AUTO:
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

    setThresholdTemperature(value, status) {
        this.debug(this.constructor.name, 'setThresholdTemperature', value, 'status');

        let commands = [];

        let currentValue = this.getThresholdTemperature(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('TargetTemp', status.mode, this.accessory.context.zone);
        let state = ('0' + value).slice(-2);
        commands.push(this.getCommand(path, state));
        
        return commands;
    }

    updateValues(status) {
        this.debug(this.constructor.name, 'updateValues', 'status');
        
        let service = this.accessory.getService(Service.HeaterCooler);
        super.updateValues(status, service);

        service.getCharacteristic(Characteristic.Active)
            .updateValue(this.getActive(status));

        service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.getCurrentHeaterCoolerState(status));

        service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .updateValue(this.getTargetHeaterCoolerState(status));

        service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .updateValue(this.getThresholdTemperature(status));

        service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .updateValue(this.getThresholdTemperature(status));
    }
}

module.exports = RinnaiTouchHeaterCooler;