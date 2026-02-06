import axios, { AxiosInstance, AxiosError } from 'axios';
import { IAuthProvider, AuthToken } from '../base/auth.interface';
import { CarrierAuthError } from '../../domain/models/error';
import { UPSTokenResponse } from './ups-types';
export interface UPSAuthConfig {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    timeout?: number;
}
export class UPSAuthProvider implements IAuthProvider {
    private cachedToken: AuthToken | null = null;
    private tokenPromise: Promise<string> | null = null;
    private readonly httpClient: AxiosInstance;

    // Buffer time before expiry to refresh token (5 minutes)
    private readonly REFRESH_BUFFER_SECONDS = 300;

    constructor(private readonly config: UPSAuthConfig) {
        this.httpClient = axios.create({
            timeout: config.timeout || 10000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    }



    async getToken(): Promise<string> {
        // Return cached token if still valid
        if (this.hasValidToken()) {
            return this.cachedToken!.accessToken;
        }

        // If token acquisition is in progress, wait for it
        if (this.tokenPromise) {
            return this.tokenPromise;
        }

        // Start new token acquisition
        this.tokenPromise = this.acquireToken();

        try {
            const token = await this.tokenPromise;
            return token;
        } finally {
            this.tokenPromise = null;
        }
    }

    async refreshToken(): Promise<string> {
        this.clearToken();
        return this.getToken();
    }

    hasValidToken(): boolean {
        if (!this.cachedToken) {
            return false;
        }

        // Check if token is expired (with buffer)
        const now = Math.floor(Date.now() / 1000);
        const expiryWithBuffer = this.cachedToken.expiresAt - this.REFRESH_BUFFER_SECONDS;

        return now < expiryWithBuffer;
    }

    clearToken(): void {
        this.cachedToken = null;
    }


    private async acquireToken(): Promise<string> {
        try {
            // Prepare credentials as Basic Auth
            const credentials = Buffer.from(
                `${this.config.clientId}:${this.config.clientSecret}`
            ).toString('base64');

            // Request token using client credentials grant
            const response = await this.httpClient.post<UPSTokenResponse>(
                this.config.tokenUrl,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                    },
                }
            );

            // Validate response
            if (!response.data.access_token) {
                throw new CarrierAuthError(
                    'Invalid token response: missing access_token',
                    'UPS',
                    response.data
                );
            }

            // Cache token with expiration time
            const now = Math.floor(Date.now() / 1000);
            this.cachedToken = {
                accessToken: response.data.access_token,
                tokenType: response.data.token_type,
                expiresIn: response.data.expires_in,
                expiresAt: now + response.data.expires_in,
            };

            return this.cachedToken.accessToken;
        } catch (error) {
            // Clear any partial state
            this.cachedToken = null;

            // Handle Axios errors
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                const status = axiosError.response?.status;
                const data = axiosError.response?.data;

                if (status === 401 || status === 403) {
                    throw new CarrierAuthError(
                        `Authentication failed: Invalid credentials (${status})`,
                        'UPS',
                        data
                    );
                }

                if (status === 429) {
                    throw new CarrierAuthError(
                        'Authentication rate limited by UPS',
                        'UPS',
                        data
                    );
                }

                // Network error (no response)
                if (!axiosError.response) {
                    throw new CarrierAuthError(
                        `Failed to acquire token: ${axiosError.message}`,
                        'UPS',
                        error
                    );
                }

                throw new CarrierAuthError(
                    `Failed to acquire token: ${axiosError.message}`,
                    'UPS',
                    error
                );
            }

            // Handle non-Axios errors (for test mocks)
            if (error && typeof error === 'object' && 'response' in error) {
                const mockError = error as any;
                const status = mockError.response?.status;
                const data = mockError.response?.data;

                if (status === 401 || status === 403) {
                    throw new CarrierAuthError(
                        `Authentication failed: Invalid credentials (${status})`,
                        'UPS',
                        data
                    );
                }

                if (status === 429) {
                    throw new CarrierAuthError(
                        'Authentication rate limited by UPS',
                        'UPS',
                        data
                    );
                }
            }

            throw new CarrierAuthError(
                `Unexpected error during token acquisition: ${error}`,
                'UPS',
                error
            );
        }
    }


    getTimeUntilExpiry(): number {
        if (!this.cachedToken) {
            return 0;
        }

        const now = Math.floor(Date.now() / 1000);
        const remaining = this.cachedToken.expiresAt - now;

        return Math.max(0, remaining);
    }
}