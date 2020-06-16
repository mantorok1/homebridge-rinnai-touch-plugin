class StateService {
    #log;
    #systemPaths = {
        HasMultiSP: 'SYST.CFG.MTSP',
        TempUnits:	'SYST.CFG.TU',
        ZoneName:	'SYST.CFG.Z{zone}',
        HasHeater:	'SYST.AVM.HG',
        HasCooler: 	'SYST.AVM.CG',
        HasEvap: 	'SYST.AVM.EC',
        Mode:		'SYST.OSS.MD',
    };
    #heatCoolPaths = {
        State:		    '{mode}.OOP.ST',    // oN, ofF
        FanState:	    '{mode}.OOP.ST',    // ofF, fanZ
        FanSpeed:	    '{mode}.OOP.FL',    // nn 01 - 16
        
        ControlMode:	'{mode}.{gz}O.OP',  // Auto, Manual
        TargetTemp:		'{mode}.{gz}O.SP',  // nn (08 - 30)
        ScheduleOverride:	'{mode}.{gz}O.AO',  // None, Advance, Operation
        
        SystemActive:   '{mode}.GSS.{m}C',  // Y,N
        SchedulePeriod:	'{mode}.{gz}S.AT',  // Wake, Leave, Return, Presleep, Sleep  

        CurrentTemp:	'{mode}.Z{zone}S.MT',   // nnn
        AutoEnabled:	'{mode}.Z{zone}S.AE',   // Y,N (is heating/cooling)
        UserEnabled:	'{mode}.Z{zone}O.UE',   // Y,N (Zone switch)

        ZoneInstalled:	'{mode}.CFG.Z{zone}IS'   // Y,N      
    };
    #evapPaths = {
        State:		    'ECOM.GSO.SW',  // oN, ofF
        FanState:		'ECOM.GSO.FS',  // oN, ofF	
        FanSpeed:		'ECOM.GSO.FL',  // nn 01 - 16
        
        ControlMode:	'ECOM.GSO.OP',  // Auto, Manual
        TargetTemp:		'ECOM.GSO.SP',  // nn (19 - 34) - comfort level
        
        SystemActive:   'ECOM.GSS.BY',  // Y,N
        CurrentTemp:	'ECOM.GSS.MT',  // nnn
        AutoEnabled:	'ECOM.GSS.Z{zone}AE',   // Y,N (is cooling)

        UserEnabled:	'ECOM.GSO.Z{zone}UE',	// Y,N (Zone switch)

        ZoneInstalled:	'ECOM.CFG.Z{zone}IS',   // Y,N
        
        PumpState:		'ECOM.GSO.PS'   // oN, ofF
    };

    constructor(log) {
        this.#log = log;
        this.#log.debug(this.constructor.name, undefined, 'log');

        this.hasMultiSetPoint = false;
    }


    getState(state, status, zone) {
        this.#log.debug(this.constructor.name, 'getState', state, zone);

        let mode = Object.keys(status[1])[0];
        let path = this.getPath(state, mode, zone);
        if (path === undefined) {
            return;
        }

        let [group1, group2, cmd] = path.split('.');
        let item = group1 === 'SYST' ? 0 : 1;

        if (status[item][group1] && status[item][group1][group2] && status[item][group1][group2][cmd]) {
            return status[item][group1][group2][cmd];
        }
    }

    getPath(state, mode, zone) {
        this.#log.debug(this.constructor.name, 'getPath', state, mode, zone);

        let path = this.#systemPaths[state];
        if (path === undefined) {
            path = mode !== 'ECOM'
                ? this.#heatCoolPaths[state]
                : this.#evapPaths[state];
        }

        if (path === undefined) {
            return;
        }

        path = path
            .replace('{mode}', mode)
            .replace('{m}', mode ? mode.substr(0, 1) : '')
            .replace('{gz}', this.hasMultiSetPoint ? 'Z{zone}' : 'GS')
            .replace('{zone}', zone);

        return path;
    }
}

module.exports = StateService;