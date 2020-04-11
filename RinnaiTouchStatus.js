class RinnaiTouchStatus {
    constructor(status, options = {}) {
        this.log = options.log || console.log;
        this.debug = options.debug === undefined ? false : options.debug;

        if (this.debug) this.log(`RinnaiTouchStatus('${status}',options)`);

        this.status = JSON.parse(status);
        this.mode = Object.keys(this.status[1])[0];
    }

    getState(path) {
        if (this.debug) this.log(`RinnaiTouchStatus.getState('${path}')`);

        if (path === undefined) {
            return undefined;
        }

        path = this.getPathArray(path);

        let state = undefined;
        if (path[2] in this.status[path[0]][path[1]]) {
            if (path[3] in this.status[path[0]][path[1]][path[2]]) {
                state = this.status[path[0]][path[1]][path[2]][path[3]];
            }
        }
        return state;
    }

    getModeState(path) {
        if (this.debug) this.log(`RinnaiTouchStatus.getModeState('${path}')`);

        if (path === undefined) {
            return undefined;
        }

        return this.getState(`${this.mode}.${path}`);
    }

    getPathArray(path) {
        if (this.debug) this.log(`RinnaiTouchStatus.getPathArray('${path}')`);

        let pathArray = path.substring(0, 4) === "SYST" ? [0] : [1];
        return pathArray.concat(path.split("."));
    }

    getZones() {
        if (this.debug) this.log('RinnaiTouchStatus.getZones()');

        let zones = [];
        for(const zone of ['A', 'B', 'C', 'D']) {
            if (this.getModeState(`CFG.Z${zone}IS`) === 'Y') {
                let name = this.getState(`SYST.CFG.Z${zone}`).trim();
                zones.push(name === '' ? `Zone ${zone}` : name);
            }
        }
        // There must be a least 1 zone
        if (zones.length === 0) {
            zones.push('Zone A');
        }

        return zones;
    }

    toString() {
        return JSON.stringify(this.status);
    }
}

module.exports = RinnaiTouchStatus;