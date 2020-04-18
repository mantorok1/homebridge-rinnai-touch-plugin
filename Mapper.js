class Mapper {
    constructor(hasMultipleControllers, overrides, log, debug) {
        this.log = log || console.log;
        this.debug = debug || false;

        this.modes = {
            HGOM: 'Heat',
            CGOM: 'Cool',
            ECOM: 'Evap'
        };
        this.map = this.generateMap(hasMultipleControllers, overrides);
    }

    getPath(key, mode, zone) {
        if (this.debug) this.log(`Mapper.getPath('${key}','${mode}','${zone}')`);

        if (mode !== undefined) {
            key = `${this.modes[mode]}${key}`;
        }
        
        let path = this.map[key]; 

        if (zone !== undefined)
            path = path.replace('{zone}', zone);
        
        return path;
    }

    generateMap(hasMultipleControllers, overrides) {
        if (this.debug) this.log(`Mapper.generateMap(${hasMultipleControllers},${JSON.stringify(overrides)})`);

        // Default - Single controller
        var map = {
            Mode: 'SYST.OSS.MD',                    // H, C, E
            SetTime: 'SYST.STM.TM',                 // or SYST.OSS.TM ?
            SetDay: 'SYST.STM.DY',

            HeatState: 'HGOM.OOP.ST',               // oN, ofF, fanZ
            HeatOperation: 'HGOM.GSO.OP',           // Auto, Manual
            HeatScheduledState: 'HGOM.GSS.AT',      // Wake, Leave, Return, Presleep?, Sleep
            HeatScheduledPeriod: 'HGOM.GSO.AO',     // Now, Advance, Override
            HeatActive: 'HGOM.Z{zone}S.AE',         // Y, N
            HeatCurrentTemp: 'HGOM.Z{zone}S.MT',    // nnn
            HeatTargetTemp: 'HGOM.GSO.SP',          // nn 08 - 30
            HeatFanSpeed: 'HGOM.OOP.FL',            // nn 01 - 16
            HeatZoneSwitch: 'HGOM.Z{zone}O.UE',     // Y, N

            CoolState: 'CGOM.OOP.ST',               // oN, ofF, fanZ
            CoolOperation: 'CGOM.GSO.OP',           // Auto, Manual
            CoolScheduledState: 'CGOM.GSS.AT',      // Wake, Leave, Return, Presleep?, Sleep
            CoolScheduledPeriod: 'CGOM.GSO.AO',     // Now, Advance, Override
            CoolActive: 'CGOM.Z{zone}S.AE',         // Y, N
            CoolCurrentTemp: 'CGOM.Z{zone}S.MT',    // nnn
            CoolTargetTemp: 'CGOM.GSO.SP',          // nn 08 - 30
            CoolFanSpeed: 'CGOM.OOP.FL',            // nn 01 - 16
            CoolZoneSwitch: 'CGOM.Z{zone}O.UE',     // Y, N

            EvapState: 'ECOM.GSO.SW',               // oN, ofF
            EvapOperation: 'ECOM.GSO.OP',           // Auto, Manual
            EvapScheduledState: 'ECOM.GSS.AT',      // Wake, Leave, Return, Presleep?, Sleep
            EvapScheduledPeriod: 'ECOM.GSO.AO',     // Now, Advance, Override
            EvapActive: 'ECOM.GSS.ZUAE',            // Y, N
            EvapCurrentTemp: 'ECOM.GSS.MT',         // nnn
            EvapFanSpeed: 'ECOM.GSO.FL',            // nn 01 - 16
            EvapZoneSwitch: 'ECOM.GSO.ZUUE',        // Y, N
            EvapPump: 'ECOM.GSO.PS',                // oN, ofF
        };

        // Multiple controllers
        if (hasMultipleControllers) {
            map.HeatOperation = 'HGOM.Z{zone}O.OP';
            map.HeatScheduledState = 'HGOM.Z{zone}S.AT',
            map.HeatScheduledPeriod = 'HGOM.Z{zone}O.AO';
            map.HeatTargetTemp = 'HGOM.Z{zone}O.SP';
            map.CoolOperation = 'CGOM.Z{zone}O.OP';
            map.CoolScheduledState = 'CGOM.Z{zone}S.AT',
            map.CoolScheduledMode = 'CGOM.Z{zone}O.AO';
            map.CoolTargetTemp = 'CGOM.Z{zone}O.SP';
        }

        // Overrides
        if (overrides) {
            for(let key in overrides) {
                map[key] = overrides[key];
            }
        }

        return map;
    }
}

module.exports = Mapper;