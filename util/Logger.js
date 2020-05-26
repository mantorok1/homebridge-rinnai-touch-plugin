class Logger {
    #log;
    #debug;

    constructor(log, debug = false) {
        this.#log = log;
        this.#debug = debug;
    }

    info(message) {
        this.#log(`[INFO] ${message}`);
    }

    warn(message) {
        this.#log(`[WARNING] ${message}`);
    }

    error(error) {
        if (this.#debug) {
            this.#log(`[ERROR] ${error.stack}`);
        } else {
            this.#log(`[ERROR] ${error.message}`);
        }
    }

    debug(className, methodName, ...args) {
        if (!this.#debug)
            return;

        let message = `[DEBUG] ${className}`;
        if (methodName) {
            message += `.${methodName}`;
        }
        message += `(${args.join(',')})`;

        this.#log(message);
    }


}

module.exports = Logger;