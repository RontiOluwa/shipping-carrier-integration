import { ICarrier } from '../base/carrier.interface';
import { RateRequest, RateQuote } from '../../domain/models/rate';
import { validateRateRequest } from '../../domain/models/rate';
import {
    CarrierBusinessError,
    CarrierNetworkError,
    CarrierResponseError,
    CarrierValidationError,
} from '../../domain/models/error';
import { HttpClient } from '../../utils/http-client';
import { UPSAuthProvider } from './ups-auth';
import { UPSMapper } from './ups-mapper';
import { UPSRateResponse, UPSErrorResponse } from './ups-types';
import { ZodError } from 'zod';

export interface UPSCarrierConfig {
    clientId: string;
    clientSecret: string;
    accountNumber: string;
    apiBaseUrl?: string;
    tokenUrl?: string;
    timeout?: number;
}

export class UPSCarrier implements ICarrier {
    readonly name = 'UPS';

    private readonly httpClient: HttpClient;
    private readonly authProvider: UPSAuthProvider;
    private readonly accountNumber: string;
    private readonly apiBaseUrl: string;

    constructor(config: UPSCarrierConfig) {
        this.accountNumber = config.accountNumber;
        this.apiBaseUrl = config.apiBaseUrl || 'https://wwwcie.ups.com/api';

        // Initialize HTTP client
        this.httpClient = new HttpClient({
            baseURL: this.apiBaseUrl,
            timeout: config.timeout || 30000,
            maxRetries: 3,
        });

        // Initialize auth provider
        this.authProvider = new UPSAuthProvider({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            tokenUrl: config.tokenUrl || 'https://wwwcie.ups.com/security/v1/oauth/token',
            timeout: Number(config.timeout),
        });
    }


    async getRates(request: RateRequest): Promise<RateQuote[]> {
        // Validate input
        try {
            validateRateRequest(request);
        } catch (error) {
            if (error instanceof ZodError) {
                const validationErrors: Record<string, string[]> = {};
                error.issues.forEach(err => {
                    const path = err.path.join('.');
                    if (!validationErrors[path]) {
                        validationErrors[path] = [];
                    }
                    validationErrors[path]?.push(err.message);
                });

                throw new CarrierValidationError(
                    'Invalid rate request',
                    validationErrors,
                    this.name
                );
            }
            throw error;
        }

        // Transform to UPS format
        const upsRequest = UPSMapper.toUPSRateRequest(request, this.accountNumber);

        try {
            // Get auth token
            const token = await this.authProvider.getToken();

            // Make API request
            const response = await this.makeRatingRequest(upsRequest, token);

            // Parse and transform response
            return this.parseRatingResponse(response);
        } catch (error) {
            // If auth error (401), try refreshing token once
            if (error instanceof CarrierNetworkError && error.statusCode === 401) {
                try {
                    const newToken = await this.authProvider.refreshToken();
                    const response = await this.makeRatingRequest(upsRequest, newToken);
                    return this.parseRatingResponse(response);
                } catch (retryError) {
                    // Rethrow original error if retry fails
                    throw error;
                }
            }

            throw error;
        }
    }

    private async makeRatingRequest(
        request: unknown,
        token: string
    ): Promise<UPSRateResponse> {
        const client = this.httpClient.getClient();

        try {
            const response = await client.post<UPSRateResponse>(
                '/rating/v1/Rate',
                request,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error) {
            // Handle UPS-specific error responses
            if (error instanceof CarrierNetworkError && error.originalError) {
                const axiosError = error.originalError as any;
                if (axiosError.response?.data) {
                    this.handleUPSError(axiosError.response.data);
                }
            }

            throw error;
        }
    }

    /**
     * Handle UPS-specific error responses
     */
    private handleUPSError(errorData: unknown): never {
        // Try to parse as UPS error format
        const upsError = errorData as UPSErrorResponse;

        if (upsError.response?.errors && Array.isArray(upsError.response.errors)) {
            const errors = upsError.response.errors;
            const firstError = errors[0];

            throw new CarrierBusinessError(
                firstError?.message || 'UPS API error',
                firstError?.code || 'UNKNOWN',
                this.name,
                errorData
            );
        }

        throw new CarrierResponseError(
            'Unexpected error response from UPS',
            errorData,
            this.name
        );
    }

    private parseRatingResponse(response: UPSRateResponse): RateQuote[] {
        try {
            // Validate response structure
            if (!response.RateResponse) {
                throw new CarrierResponseError(
                    'Invalid response: missing RateResponse',
                    response,
                    this.name
                );
            }

            const rateResponse = response.RateResponse;

            // Check for response errors
            if (rateResponse.Response.ResponseStatus.Code !== '1') {
                const description = rateResponse.Response.ResponseStatus.Description;
                throw new CarrierBusinessError(
                    description || 'Rating request failed',
                    rateResponse.Response.ResponseStatus.Code,
                    this.name,
                    response
                );
            }

            // Handle alerts
            if (rateResponse.Response.Alert && rateResponse.Response.Alert.length > 0) {
                // Log alerts but don't fail
                // In production, you'd use a proper logger
                console.warn('UPS Rating Alerts:', rateResponse.Response.Alert);
            }

            // Get rated shipments
            const { RatedShipment } = rateResponse;

            if (!RatedShipment) {
                return []; // No rates available
            }

            // Normalize to array and map to domain quotes
            const shipments = UPSMapper.normalizeRatedShipments(RatedShipment);
            return shipments.map(shipment => UPSMapper.toRateQuote(shipment));
        } catch (error) {
            if (error instanceof CarrierBusinessError || error instanceof CarrierResponseError) {
                throw error;
            }

            throw new CarrierResponseError(
                `Failed to parse UPS rating response: ${error}`,
                response,
                this.name
            );
        }
    }

    async canService(originCountry: string, destinationCountry: string): Promise<boolean> {
        // For now, assume UPS services all countries
        // In production, this would check UPS's service area
        return true;
    }
}