class Mapper {
    #log;
    #settings;
    #mapSingle;
    #mapMulti;

    constructor(log, settings) {
        this.#log = log;
        this.#log.debug(this.constructor.name, undefined, 'log', 'settings');
        this.#settings = settings;

        this.modes = {
            HGOM: 'Heat',
            CGOM: 'Cool',
            ECOM: 'Evap'
        };

        this.#mapSingle = this.generateSingleMap();
        this.#mapMulti = this.generateMultiMap();
    }

    generateSingleMap() {
        this.#log.debug(this.constructor.name, 'generateSingleMap');

        let map = this.defaultMap();

        // Overrides
        if (this.#settings.mapOverrides) {
            for(let key in this.#settings.mapOverrides) {
                map[key] = this.#settings.mapOverrides[key];
            }
        }

        return map;
    }

    generateMultiMap() {
        this.#log.debug(this.constructor.name, 'generateMultiMap');

        let map = this.defaultMap();

        // Multiple controllers
        map.HeatOperation = 'HGOM.Z{zone}O.OP';
        map.HeatSchedulePeriod = 'HGOM.Z{zone}S.AT',
        map.HeatScheduleState = 'HGOM.Z{zone}O.AO';
        map.HeatTargetTemp = 'HGOM.Z{zone}O.SP';
        map.CoolOperation = 'CGOM.Z{zone}O.OP';
        map.CoolSchedulePeriod = 'CGOM.Z{zone}S.AT',
        map.CoolScheduleState = 'CGOM.Z{zone}O.AO';
        map.CoolTargetTemp = 'CGOM.Z{zone}O.SP';

        // Overrides
        if (this.#settings.mapOverrides) {
            for(let key in this.#settings.mapOverrides) {
                map[key] = this.#settings.mapOverrides[key];
            }
        }

        return map;
    }

    defaultMap() {
        this.#log.debug(this.constructor.name, 'defaultMap');

        return {
            Mode: 'SYST.OSS.MD',                    // H, C, E
            TempUnits: 'SYST.CFG.TU',               // Celsius, Fahrenheit

            HeatState: 'HGOM.OOP.ST',               // oN, ofF, fanZ
            HeatOperation: 'HGOM.GSO.OP',           // Auto, Manual
            HeatSchedulePeriod: 'HGOM.GSS.AT',      // Wake, Leave, Return, Presleep, Sleep
            HeatScheduleState: 'HGOM.GSO.AO',       // Now, Advance, Override
            HeatActive: 'HGOM.Z{zone}S.AE',         // Y, N
            HeatCurrentTemp: 'HGOM.Z{zone}S.MT',    // nnn
            HeatTargetTemp: 'HGOM.GSO.SP',          // nn 08 - 30
            HeatFanSpeed: 'HGOM.OOP.FL',            // nn 01 - 16
            HeatZoneSwitch: 'HGOM.Z{zone}O.UE',     // Y, N

            CoolState: 'CGOM.OOP.ST',               // oN, ofF, fanZ
            CoolOperation: 'CGOM.GSO.OP',           // Auto, Manual
            CoolSchedulePeriod: 'CGOM.GSS.AT',      // Wake, Leave, Return, Presleep?, Sleep
            CoolScheduleState: 'CGOM.GSO.AO',       // Now, Advance, Override
            CoolActive: 'CGOM.Z{zone}S.AE',         // Y, N
            CoolCurrentTemp: 'CGOM.Z{zone}S.MT',    // nnn
            CoolTargetTemp: 'CGOM.GSO.SP',          // nn 08 - 30
            CoolFanSpeed: 'CGOM.OOP.FL',            // nn 01 - 16
            CoolZoneSwitch: 'CGOM.Z{zone}O.UE',     // Y, N

            EvapState: 'ECOM.GSO.SW',               // oN, ofF
            EvapOperation: 'ECOM.GSO.OP',           // Auto, Manual
            EvapSchedulePeriod: 'ECOM.GSS.AT',      // Wake, Leave, Return, Presleep, Sleep
            EvapScheduleState: 'ECOM.GSO.AO',       // Now, Advance, Override
            EvapActive: 'ECOM.GSS.ZUAE',            // Y, N
            EvapCurrentTemp: 'ECOM.GSS.MT',         // nnn
            EvapFanSpeed: 'ECOM.GSO.FL',            // nn 01 - 16
            EvapZoneSwitch: 'ECOM.GSO.ZUUE',        // Y, N
            EvapPump: 'ECOM.GSO.PS',                // oN, ofF
        };
    }

    getPath(key, mode, zone) {
        this.#log.debug(this.constructor.name, 'getPath', key, mode, zone);

        let map = this.#settings.controllers === 1 ? this.#mapSingle : this.#mapMulti;

        if (mode !== undefined) {
            key = `${this.modes[mode]}${key}`;
        }
        
        let path = map[key]; 

        if (zone !== undefined)
            path = path.replace('{zone}', zone);
        
        return path;
    }
}

module.exports = Mapper;