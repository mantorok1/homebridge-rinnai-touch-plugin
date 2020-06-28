const EventEmitter = require('events');
const StateService = require('./StateService');

class RinnaiTouchService extends EventEmitter {
    #log;
    #repository;
    #stateService;
    #states = {
        ZoneName: {U: 'Common'},
        Zones: [],
        Controllers: [],
        CurrentTemperature: {},
        CurrentTemperatureOverride: {}
    };
    #timestamp = 0;
    #previousMode;
    #RinnaiTouchModes = {
        0: 'HGOM',
        1: 'CGOM',
        2: 'ECOM'
    };

    constructor(log, repository) {
        super();
        this.#log = log;
        this.#log.debug(this.constructor.name, undefined, 'log', 'repository');

        this.#repository = repository;
        this.#stateService = new StateService(log);
    }

    async init() {
        this.#log.debug(this.constructor.name, 'init');

        try {
            let status = await this.#repository.execute({type: 'get'});

            for(let state of ['HasHeater','HasCooler','HasEvap','HasMultiSP']) {
                this.#states[state] = this.#stateService.getState(state, status) === 'Y';
            }
            this.#stateService.hasMultiSetPoint = this.hasMultiSetPoint;

            // Zone Names
            for(let zone of ['A','B','C','D']) {
                let name = this.#stateService.getState('ZoneName', status, zone);
                this.#states.ZoneName[zone] = name.trim() === ''
                    ? `Zone ${zone}`
                    : name.trim();
            }

            // Controllers
            if (!this.hasMultiSetPoint) {
                this.#states.Controllers = ['U'];
            } else {
                for(let zone of ['A','B','C','D']) {
                    let installed = this.#stateService.getState('ZoneInstalled', status, zone);
                    if (installed === 'Y') {
                        this.#states.Controllers.push(zone);
                    }
                }
            }

            await this.updateStates();

            this.#repository.on('status', this.updateAll.bind(this));
        }
        catch(error) {
            this.#log.error(error);
            throw error;
        }
    }

    get Modes() {
        return {HEAT: 0, COOL: 1, EVAP: 2};
    }

    get AllZones() {
        return ['U','A','B','C','D'];
    }

    get ControlModes() {
        return {MANUAL: 0, SCHEDULE: 1};
    }

    get ScheduleOverrideModes() {
        return {NONE: 0, ADVANCE: 1, OPERATION: 2};
    }

    //
    // Getters
    //
    get hasHeater() {
        this.#log.debug(this.constructor.name, 'hasHeater');
        return this.#states.HasHeater;
    }

    get hasCooler() {
        this.#log.debug(this.constructor.name, 'hasCooler');
        return this.#states.HasCooler;
    }

    get hasEvaporative() {
        this.#log.debug(this.constructor.name, 'hasEvaporative');
        return this.#states.HasEvap;
    }

    get hasMultiSetPoint() {
        this.#log.debug(this.constructor.name, 'hasMultiSetPoint');
        return this.#states.HasMultiSP;
    }

    get mode() {
        this.#log.debug(this.constructor.name, 'mode');
        return this.#states.Mode;
    }

    get zones() {
        this.#log.debug(this.constructor.name, 'zones');
        return this.#states.Zones;
    }

    get controllers() {
        this.#log.debug(this.constructor.name, 'controllers');
        return this.#states.Controllers;
    }

    getZoneName(zone) {
        this.#log.debug(this.constructor.name, 'getZoneName', zone);
        return this.#states.ZoneName[zone];
    }

    getState() {
        this.#log.debug(this.constructor.name, 'getState');
        return this.#states.State;       
    }

    getFanState() {
        this.#log.debug(this.constructor.name, 'getFanState');
        return this.#states.FanState;       
    }

    getFanSpeed() {
        this.#log.debug(this.constructor.name, 'getFanSpeed');
        return this.#states.FanSpeed;        
    }

    getTemperatureUnits() {
        this.#log.debug(this.constructor.name, 'getTemperatureUnits');
        return this.#states.TemperatureUnits;
    }

    getCurrentTemperature(zone) {
        this.#log.debug(this.constructor.name, 'getCurrentTemperature', zone);

        return this.#states.CurrentTemperatureOverride[zone] === undefined
            ? this.#states.CurrentTemperature[zone]
            : this.#states.CurrentTemperatureOverride[zone];
    }

    getTargetTemperature(zone = 'U') {
        this.#log.debug(this.constructor.name, 'getTargetTemperature', zone);
        return this.#states.TargetTemperature[zone];       
    }

    getSystemActive(zone) {
        this.#log.debug(this.constructor.name, 'getSystemActive', zone);
        return this.hasMultiSetPoint
            ? this.getAutoEnabled(zone)
            : this.#states.SystemActive;
    }

    getAutoEnabled(zone) {
        this.#log.debug(this.constructor.name, 'getAutoEnabled', zone);
        return this.#states.AutoEnabled[zone];        
    }

    getUserEnabled(zone) {
        this.#log.debug(this.constructor.name, 'getUserEnabled', zone);
        return this.#states.UserEnabled[zone];        
    }

    getControlMode(zone = 'U') {
        this.#log.debug(this.constructor.name, 'getControlMode', zone);
        return this.#states.ControlMode[zone];         
    }

    getScheduleOverride(zone) {
        this.#log.debug(this.constructor.name, 'getScheduleOverride', zone);
        return this.#states.ScheduleOverride[zone];         
    }

    getPumpState() {
        this.#log.debug(this.constructor.name, 'getPumpState');
        return this.#states.PumpState;       
    }

    //
    // Updaters
    //
    async updateStates() {
        this.#log.debug(this.constructor.name, 'updateStates');

        try {
            let status = await this.#repository.execute({type: 'get'});

            if (Date.now() - this.#timestamp < 1000) {
                return;
            }

            this.updateAll(status);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    updateAll(status) {
        this.#log.debug(this.constructor.name, 'updateAll', 'status');

        const previousStates = JSON.stringify(this.#states);

        this.updateMode(status);
        this.updateZones(status);
        this.updateState(status);
        this.updateFanState(status);
        this.updateFanSpeed(status);
        this.updateCurrentTemperature(status);
        this.updateTargetTemperature(status);
        this.updateTemperatureUnits(status);
        this.updateSystemActive(status);
        this.updateAutoEnabled(status);
        this.updateUserEnabled(status);
        this.updateControlMode(status);
        this.updateScheduleOverride(status);
        this.updatePumpState(status);

        this.#timestamp = Date.now();

        if (this.#previousMode !== this.mode) {
            if (this.#previousMode !== undefined) {
                this.emit('mode', this.mode);
            }
            this.#previousMode = this.mode; 
        }

        if (previousStates !== JSON.stringify(this.#states)) {
            this.emit('updated');
        }
    }

    updateMode(status) {
        this.#log.debug(this.constructor.name, 'updateMode', 'status');

        let state = this.#stateService.getState('Mode', status);
        let mode;
        switch (state) {
            case 'H':
                mode = this.Modes.HEAT;
                break;
            case 'C':
                mode = this.Modes.COOL;
                break;
            case 'E':
                mode = this.Modes.EVAP;
                break;
            default:
                throw new Error(`Unsupported mode '${state}'`);
        }

        this.#states.Mode = mode;
    }

    updateZones(status) {
        this.#log.debug(this.constructor.name, 'updateZones', 'status');

        let zones = [];
        for(let zone of this.AllZones) {
            let installed = this.#stateService.getState('ZoneInstalled', status, zone);
            if (installed === 'Y') {
                zones.push(zone);
            }
        }

        this.#states.Zones = zones;
    }

    updateState(status) {
        this.#log.debug(this.constructor.name, 'updateState', 'status');

        let state = this.#stateService.getState('State', status);

        this.#states.State = state === 'N';
    }

    updateFanState(status) {
        this.#log.debug(this.constructor.name, 'updateFanState', 'status');

        let state = this.#stateService.getState('FanState', status);

        this.#states.FanState = this.mode === this.Modes.EVAP
            ? state === 'N'
            : state === 'Z';
    }

    updateFanSpeed(status) {
        this.#log.debug(this.constructor.name, 'updateFanSpeed', 'status');

        let state = this.#stateService.getState('FanSpeed', status);

        this.#states.FanSpeed = parseInt(state);
    }

    updateTemperatureUnits(status) {
        this.#log.debug(this.constructor.name, 'updateTemperatureUnits', 'status');

        let state = this.#stateService.getState('TempUnits', status);

        this.#states.TemperatureUnits = state;
    }

    updateCurrentTemperature(status) {
        this.#log.debug(this.constructor.name, 'updateCurrentTemperature', 'status');

        for(let zone of this.AllZones) {
            let state = this.#stateService.getState('CurrentTemp', status, zone);
            if (state !== '999') {
                this.#states.CurrentTemperature[zone] = parseFloat(state) / 10.0;
            }
        }
    }

    updateTargetTemperature(status) {
        this.#log.debug(this.constructor.name, 'updateTargetTemperature', 'status');

        let states = {};
        let zones = this.hasMultiSetPoint ? this.controllers : ['U']; 
        for(let zone of zones) {
            let state = this.#stateService.getState('TargetTemp', status, zone);
            if (state) {
                states[zone] = this.mode === this.Modes.EVAP
                    ? Math.round((parseInt(state)-19) / 15 * 22 + 8) // Convert Comfort level to Temperature
                    : parseInt(state);
            }
        }

        this.#states.TargetTemperature = states;
    }

    updateSystemActive(status) {
        this.#log.debug(this.constructor.name, 'updateSystemActive', 'status');

        if (!this.hasMultiSetPoint) {
            let state = this.#stateService.getState('SystemActive', status);
            if (state) {
                this.#states.SystemActive = state === 'Y';
            }
        }
    }

    updateAutoEnabled(status) {
        this.#log.debug(this.constructor.name, 'updateAutoEnabled', 'status');

        let states = {};
        for(let zone of this.AllZones) {
            let state = this.#stateService.getState('AutoEnabled', status, zone);
            states[zone] = state === 'Y';
        }

        this.#states.AutoEnabled = states;    
    }

    updateUserEnabled(status) {
        this.#log.debug(this.constructor.name, 'updateUserEnabled', 'status');

        let states = {};
        for(let zone of this.AllZones) {
            let state = this.#stateService.getState('UserEnabled', status, zone);
            states[zone] = state === 'Y';
        }

        this.#states.UserEnabled = states;    
    }

    updateControlMode(status) {
        this.#log.debug(this.constructor.name, 'updateControlMode', 'status');

        let states = {};
        let zones = this.hasMultiSetPoint ? this.controllers : ['U'];
        for(let zone of zones) {
            let state = this.#stateService.getState('ControlMode', status, zone);
            if (state !== undefined) {
                states[zone] = state === 'M'
                    ? this.ControlModes.MANUAL
                    : this.ControlModes.SCHEDULE;
            }
        }

        this.#states.ControlMode = states;
    }

    updateScheduleOverride(status) {
        this.#log.debug(this.constructor.name, 'updateScheduleOverride', 'status');

        let states = {};
        let zones = this.hasMultiSetPoint ? this.controllers : ['U'];
        for(let zone of zones) {
            let state = this.#stateService.getState('ScheduleOverride', status, zone);
            if (state !== undefined) {
                switch(state) {
                    case 'N':
                        states[zone] = this.ScheduleOverrideModes.NONE;
                        break;
                    case 'A':
                        states[zone] = this.ScheduleOverrideModes.ADVANCE;
                        break;
                    case 'O':
                        states[zone] = this.ScheduleOverrideModes.OPERATION;
                        break;
                }  
            }
        }

        this.#states.ScheduleOverride = states;
    }

    updatePumpState(status) {
        this.#log.debug(this.constructor.name, 'updatePumpState', 'status');

        let state = this.#stateService.getState('PumpState', status);

        this.#states.PumpState = state === 'N';
    }

    //
    // Setters
    //
    async setMode(value) {
        this.#log.debug(this.constructor.name, 'setMode', value);

        try {
            await this.updateStates();
    
            if (this.mode === value) {
                return;
            }
    
            let path = this.#stateService.getPath('Mode');
            let state = this.#RinnaiTouchModes[value].substr(0, 1);
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }

    }

    async setState(value) {
        this.#log.debug(this.constructor.name, 'setState', value);

        try {
            await this.updateStates();
    
            if (this.getState() === value) {
                return;
            }
    
            let mode = this.getRinnaiTouchMode();
            let path = this.#stateService.getPath('State', mode);
            let state = value ? 'N' : 'F';
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setFanState(value) {
        this.#log.debug(this.constructor.name, 'setFanState', value);

        try {
            await this.updateStates();
    
            if (this.getFanState() === value) {
                return;
            }
    
            let mode = this.getRinnaiTouchMode();
            let path = this.#stateService.getPath('FanState', mode);
            let state = value
                ? (this.mode === this.Modes.EVAP) ? 'N' : 'Z'
                : 'F';
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setFanSpeed(value) {
        this.#log.debug(this.constructor.name, 'setFanSpeed', value);

        try {
            await this.updateStates();
    
            if (this.getFanSpeed() === value) {
                return;
            }
    
            let mode = this.getRinnaiTouchMode();
            let path = this.#stateService.getPath('FanSpeed', mode);
            let state = value.toString().padStart(2, '0');
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    setCurrentTemperatureOverride(value, zone) {
        this.#log.debug(this.constructor.name, 'setCurrentTemperatureOverride', value, zone);

        if (this.#states.CurrentTemperatureOverride[zone] !== value) {
            this.#states.CurrentTemperatureOverride[zone] = value;
            this.emit('updated');
        }
    }

    async setTargetTemperature(value, zone = 'U') {
        this.#log.debug(this.constructor.name, 'setTargetTemperature', value, zone);

        try {
            await this.updateStates();
    
            if (this.getTargetTemperature(zone) === parseInt(value)) {
                return;
            }
    
            let mode = this.getRinnaiTouchMode();
            let path = this.#stateService.getPath('TargetTemp', mode, zone);
            let state = this.mode === this.Modes.EVAP
                ? Math.round((parseInt(value) - 8) / 22 * 15 + 19)
                : parseInt(value);

            state = state.toString().padStart(2, '0');
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    // Zone Switch
    async setUserEnabled(value, zone) {
        this.#log.debug(this.constructor.name, 'setUserEnabled', value, zone);

        try {
            await this.updateStates();
    
            if (this.getUserEnabled(zone) === value) {
                return;
            }
    
            let mode = this.getRinnaiTouchMode();
            let path = this.#stateService.getPath('UserEnabled', mode, zone);
            let state = value ? 'Y' : 'N';
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setControlMode(value, zone = 'U') {
        this.#log.debug(this.constructor.name, 'setControlMode', value, zone);

        try {
            await this.updateStates();

            if (this.getControlMode(zone) === value) {
                return;
            }
    
            let mode = this.getRinnaiTouchMode();
            let path = this.#stateService.getPath('ControlMode', mode, zone);
            let state = value === this.ControlModes.MANUAL ? 'M' : 'A';
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setScheduleOverride(value, zone) {
        this.#log.debug(this.constructor.name, 'setScheduleOverride', value, zone);

        try {
            await this.updateStates();
    
            if (this.getScheduleOverride(zone) === value) {
                return;
            }
    
            let mode = this.getRinnaiTouchMode();
            let path = this.#stateService.getPath('ScheduleOverride', mode, zone);
            let state;
            switch (value) {
                case this.ScheduleOverrideModes.NONE:
                    state = 'N';
                    break;
                case this.ScheduleOverrideModes.ADVANCE:
                    state = 'A';
                    break;
                case this.ScheduleOverrideModes.OPERATION:
                    state = 'O';
                    break;
            }
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setPumpState(value) {
        this.#log.debug(this.constructor.name, 'setPumpState', value);

        try {
            await this.updateStates();
    
            if (this.getPumpState() === value) {
                return;
            }
    
            let mode = this.getRinnaiTouchMode();
            let path = this.#stateService.getPath('PumpState', mode);
            let state = value ? 'N' : 'F';
    
            await this.sendRequest(path, state);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    //
    // Helpers
    //
    getRinnaiTouchMode() {
        this.#log.debug(this.constructor.name, 'getRinnaiTouchMode');

        return this.#RinnaiTouchModes[this.mode];
    }

    async sendRequest(path, state) {
        this.#log.debug(this.constructor.name, 'sendRequest', path, state);

        if (path === undefined || state === undefined) {
            this.#log.warn('Invalid request. Cannot send command');
            return;
        }

        try {
            let request = {
                type: 'set',
                path: path,
                state: state
            };
    
            await this.#repository.execute(request);
        }
        catch(error) {
            this.#log.error(error);
        }
    }
}

module.exports = RinnaiTouchService;