
export abstract class CarrierError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly carrier?: string,
        public readonly originalError?: unknown
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }


    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            carrier: this.carrier,
            // ...(this.originalError && { originalError: String(this.originalError) }),
        };
    }
}

export class CarrierAuthError extends CarrierError {
    constructor(
        message: string,
        carrier?: string,
        originalError?: unknown
    ) {
        super(message, 'AUTH_ERROR', carrier, originalError);
    }
}

export class CarrierNetworkError extends CarrierError {
    constructor(
        message: string,
        public readonly statusCode?: unknown,
        carrier?: string,
        originalError?: unknown
    ) {
        super(message, 'NETWORK_ERROR', carrier, originalError);
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            statusCode: this.statusCode,
        };
    }
}
export class CarrierValidationError extends CarrierError {
    constructor(
        message: string,
        public readonly validationErrors?: Record<string, string[]>,
        carrier?: string
    ) {
        super(message, 'VALIDATION_ERROR', carrier);
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            validationErrors: this.validationErrors,
        };
    }
}
export class CarrierRateLimitError extends CarrierError {
    constructor(
        message: string,
        public readonly retryAfter?: any, // seconds
        carrier?: string,
        originalError?: unknown
    ) {
        super(message, 'RATE_LIMIT_ERROR', carrier, originalError);
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter,
        };
    }
}


export class CarrierResponseError extends CarrierError {
    constructor(
        message: string,
        public readonly response?: unknown,
        carrier?: string,
        originalError?: unknown
    ) {
        super(message, 'RESPONSE_ERROR', carrier, originalError);
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            response: this.response,
        };
    }
}

export class CarrierBusinessError extends CarrierError {
    constructor(
        message: string,
        code: string,
        carrier?: string,
        originalError?: unknown
    ) {
        super(message, code, carrier, originalError);
    }
}

export class CarrierConfigError extends CarrierError {
    constructor(
        message: string,
        public readonly missingFields?: string[]
    ) {
        super(message, 'CONFIG_ERROR');
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            missingFields: this.missingFields,
        };
    }
}

export function isCarrierError(error: unknown): error is CarrierError {
    return error instanceof CarrierError;
}


export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}