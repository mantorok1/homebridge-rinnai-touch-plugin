const RinnaiTouchTemperature = require('./RinnaiTouchTemperature');

let Accessory, Service, Characteristic, UUIDGen;

class RinnaiTouchHeaterCooler extends RinnaiTouchTemperature {
    #settingMode;

    constructor(platform) {
        super(platform);
        this.log.debug(this.constructor.name, undefined, 'platform');

        this.name = 'HeaterCooler';

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    init(name, zone) {
        this.log.debug(this.constructor.name, 'init', name, zone);
        
        super.init(name, zone)

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
        this.updateValues();
    }

    getValidCurrentHeaterCoolerStates () {
        this.log.debug(this.constructor.name, 'getValidCurrentHeaterCoolerStates');

        let validStates = [Characteristic.CurrentHeaterCoolerState.IDLE];
        if (this.service.hasHeater) {
            validStates.push(Characteristic.CurrentHeaterCoolerState.HEATING);
        }
        if (this.service.hasCooler || this.service.hasEvaporative) {
            validStates.push(Characteristic.CurrentHeaterCoolerState.COOLING);
        }
        return validStates;
    }

    getValidTargetHeaterCoolerStates() {
        this.log.debug(this.constructor.name, 'getValidTargetHeaterCoolerStates');

        let validStates = [];
        if (this.settings.showAuto && (this.service.hasMultiSetPoint || this.accessory.context.zone === 'U')) {
            validStates.push(Characteristic.TargetHeaterCoolerState.AUTO);
        }
        if (this.service.hasHeater) {
            validStates.push(Characteristic.TargetHeaterCoolerState.HEAT);
        }
        if (this.service.hasCooler || this.service.hasEvaporative) {
            validStates.push(Characteristic.TargetHeaterCoolerState.COOL);
        }

        return validStates;
    }

    setEventHandlers() {
        this.log.debug(this.constructor.name, 'setEventHandlers');

        let service = this.accessory.getService(Service.HeaterCooler);
        super.setEventHandlers(service);

        service.getCharacteristic(Characteristic.Active)
            .on('get', this.getCharacteristicValue.bind(this, this.getActive.bind(this), 'Active'))
            .on('set', this.setCharacteristicValue.bind(this, this.setActive.bind(this), 'Active'));

        service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .on('get', this.getCharacteristicValue.bind(this, this.getCurrentHeaterCoolerState.bind(this), 'CurrentHeaterCoolerState'));

        service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .on('get', this.getCharacteristicValue.bind(this, this.getTargetHeaterCoolerState.bind(this), 'TargetHeaterCoolerState'))
            .on('set', this.setCharacteristicValue.bind(this, this.setTargetHeaterCoolerState.bind(this), 'TargetHeaterCoolerState'));

        service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .on('get', this.getCharacteristicValue.bind(this, this.getThresholdTemperature.bind(this), 'HeatingThresholdTemperature'))
            .on('set', this.setCharacteristicValue.bind(this, this.setThresholdTemperature.bind(this), 'HeatingThresholdTemperature'));

        service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .on('get', this.getCharacteristicValue.bind(this, this.getThresholdTemperature.bind(this), 'CoolingThresholdTemperature'))
            .on('set', this.setCharacteristicValue.bind(this, this.setThresholdTemperature.bind(this), 'CoolingThresholdTemperature'));
    }

    getActive() {
        this.log.debug(this.constructor.name, 'getActive');

        let state = this.service.hasMultiSetPoint || this.accessory.context.zone === 'U'
            ? this.service.getState()
            : this.service.getUserEnabled(this.accessory.context.zone);

        return state
            ? Characteristic.Active.ACTIVE
            : Characteristic.Active.INACTIVE;
    }

    getCurrentHeaterCoolerState() {
        this.log.debug(this.constructor.name, 'getCurrentHeaterCoolerState');

        let state = this.accessory.context.zone === 'U'
            ? this.service.getSystemActive(this.accessory.context.zone)
            : this.service.getAutoEnabled(this.accessory.context.zone);

        if (!state) {
            return Characteristic.CurrentHeaterCoolerState.IDLE;
        }

        if (this.service.mode === this.service.Modes.HEAT) {
            return Characteristic.CurrentHeaterCoolerState.HEATING;
        }

        return Characteristic.CurrentHeaterCoolerState.COOLING;
    }

    getTargetHeaterCoolerState() {
        this.log.debug(this.constructor.name, 'getTargetHeaterCoolerState');

        if (this.service.mode === this.service.Modes.HEAT) {
            return Characteristic.TargetHeaterCoolerState.HEAT;
        }
 
        return Characteristic.TargetHeaterCoolerState.COOL;
    }

    getThresholdTemperature() {
        this.log.debug(this.constructor.name, 'getThresholdTemperature');

        let zone = this.service.hasMultiSetPoint
            ? this.accessory.context.zone
            : 'U';

        return this.service.getTargetTemperature(zone);
    }

    async setActive(value) {
        this.log.debug(this.constructor.name, 'setActive', value);

        if (!this.service.hasMultiSetPoint && this.accessory.context.zone !== 'U') {
            if (this.service.getState() || this.service.getFanState()) {
                await this.service.setUserEnabled(value === Characteristic.Active.ACTIVE, this.accessory.context.zone);
                return;
            }
        }

        if (this.service.getFanState() && value === Characteristic.Active.INACTIVE) {
            return;
        }

        if (value === Characteristic.Active.INACTIVE) {
            await this.service.setState(false);
            return;
        }

        await this.setModeComplete();
        await this.service.setFanState(false);
        await this.service.setState(true);
    }

    async setTargetHeaterCoolerState(value) {
        this.log.debug(this.constructor.name, 'setTargetHeaterCoolerState', value);

        this.#settingMode = true;

        switch (value) {
            case Characteristic.TargetHeaterCoolerState.HEAT:
                await this.service.setMode(this.service.Modes.HEAT);
                break;
            case Characteristic.TargetHeaterCoolerState.COOL:
                if (this.service.hasCooler) {
                    await this.service.setMode(this.service.Modes.COOL);
                } else {
                    await this.service.setMode(this.service.Modes.EVAP);
                }
                break;
            case Characteristic.TargetHeaterCoolerState.AUTO:
                if (this.service.getState()) {
                    await this.service.setControlMode(this.service.ControlModes.SCHEDULE, this.accessory.context.zone);
                    await this.service.setScheduleOverride(this.service.ScheduleOverrideModes.NONE, this.accessory.context.zone);    
                }
                // Force update values so mode switches back to correct mode
                setTimeout(this.updateValues.bind(this), 1000);    
                break;
        }

        this.#settingMode = false;
    }

    async setThresholdTemperature(value) {
        this.log.debug(this.constructor.name, 'setThresholdTemperature', value);

        if (this.getThresholdTemperature() === value) {
            return;
        }

        let zone = this.service.hasMultiSetPoint
            ? this.accessory.context.zone
            : 'U';

        await this.setModeComplete();
        await this.service.setTargetTemperature(value, zone);
    }

    async setModeComplete() {
        this.log.debug(this.constructor.name, 'setModeComplete');

        if (!this.#settingMode) {
            return;
        }

        const start = Date.now();
        while (Date.now() - start < 10000) {
            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });

            if (!this.#settingMode) {
                break;
            }
        }
    }

    updateValues() {
        this.log.debug(this.constructor.name, 'updateValues');
        
        let service = this.accessory.getService(Service.HeaterCooler);
        super.updateValues(service);

        service.getCharacteristic(Characteristic.Active)
            .updateValue(this.getActive());

        service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.getCurrentHeaterCoolerState());

        service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .updateValue(this.getTargetHeaterCoolerState());

        service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .updateValue(this.getThresholdTemperature());

        service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .updateValue(this.getThresholdTemperature());
    }
}

module.exports = RinnaiTouchHeaterCooler;