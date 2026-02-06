import { config as loadEnv } from 'dotenv';
import { CarrierConfigError } from '../domain/models/error';

// Load .env file if it exists
loadEnv();


export interface UPSConfig {
    clientId: string;
    clientSecret: string;
    accountNumber: string;
    apiBaseUrl: string;
    tokenUrl: string;
}
export interface HttpConfig {
    timeout: number;
    maxRetries: number;
}
export interface AppConfig {
    ups: UPSConfig;
    http: HttpConfig;
    nodeEnv: string;
}

function getUPSConfig(): UPSConfig {
    const required = {
        clientId: process.env.UPS_CLIENT_ID,
        clientSecret: process.env.UPS_CLIENT_SECRET,
        accountNumber: process.env.UPS_ACCOUNT_NUMBER,
    };

    const missing = Object.entries(required)
        .filter(([_, value]) => !value)
        .map(([key]) => `UPS_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

    if (missing.length > 0) {
        throw new CarrierConfigError(
            `Missing required UPS configuration: ${missing.join(', ')}`,
            missing
        );
    }

    return {
        clientId: required.clientId!,
        clientSecret: required.clientSecret!,
        accountNumber: required.accountNumber!,
        apiBaseUrl: process.env.UPS_API_BASE_URL || 'https://wwwcie.ups.com/api',
        tokenUrl: process.env.UPS_TOKEN_URL || 'https://wwwcie.ups.com/security/v1/oauth/token',
    };
}

function getHttpConfig(): HttpConfig {
    return {
        timeout: parseInt(process.env.HTTP_TIMEOUT || '30000', 10),
        maxRetries: parseInt(process.env.HTTP_MAX_RETRIES || '3', 10),
    };
}


export const config: AppConfig = {
    ups: getUPSConfig(),
    http: getHttpConfig(),
    nodeEnv: process.env.NODE_ENV || 'development',
};

export function isTestEnvironment(): boolean {
    return config.nodeEnv === 'test' || process.env.NODE_ENV === 'test';
}

export function isProduction(): boolean {
    return config.nodeEnv === 'production';
}