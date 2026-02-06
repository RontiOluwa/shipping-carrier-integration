import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { UPSCarrier } from '../../src/carriers/ups/ups-carrier';
import { RateRequest } from '../../src/domain/models/rate';
import {
    CarrierValidationError,
    CarrierBusinessError,
    CarrierNetworkError,
    CarrierResponseError,
} from '../../src/domain/models/error';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('UPSCarrier Integration Tests', () => {
    let carrier: UPSCarrier;
    let mockAxiosInstance: any;

    const validConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        accountNumber: '12345',
        apiBaseUrl: 'https://wwwcie.ups.com/api',
        tokenUrl: 'https://wwwcie.ups.com/security/v1/oauth/token',
    };

    const validRateRequest: RateRequest = {
        origin: {
            street1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US',
        },
        destination: {
            street1: '456 Market St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
        },
        packages: [
            {
                weight: 5,
                weightUnit: 'LB',
                dimensions: {
                    length: 12,
                    width: 8,
                    height: 6,
                    unit: 'IN',
                },
            },
        ],
    };

    // Sample UPS token response from documentation
    const mockTokenResponse = {
        data: {
            access_token: 'test-access-token-123',
            token_type: 'Bearer',
            expires_in: 3600,
        },
    };

    // Sample UPS rating response from documentation
    const mockSuccessfulRatingResponse = {
        data: {
            RateResponse: {
                Response: {
                    ResponseStatus: {
                        Code: '1',
                        Description: 'Success',
                    },
                },
                RatedShipment: [
                    {
                        Service: {
                            Code: '03',
                            Description: 'UPS Ground',
                        },
                        TotalCharges: {
                            CurrencyCode: 'USD',
                            MonetaryValue: '25.50',
                        },
                        NegotiatedRateCharges: {
                            TotalCharge: {
                                CurrencyCode: 'USD',
                                MonetaryValue: '23.75',
                            },
                        },
                        GuaranteedDelivery: {
                            BusinessDaysInTransit: '3',
                        },
                    },
                    {
                        Service: {
                            Code: '02',
                            Description: 'UPS Second Day Air',
                        },
                        TotalCharges: {
                            CurrencyCode: 'USD',
                            MonetaryValue: '45.00',
                        },
                        TransportationCharges: {
                            CurrencyCode: 'USD',
                            MonetaryValue: '42.00',
                        },
                        GuaranteedDelivery: {
                            BusinessDaysInTransit: '2',
                        },
                    },
                ],
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup axios mock
        mockAxiosInstance = {
            post: vi.fn(),
            get: vi.fn(),
            interceptors: {
                request: { use: vi.fn() },
                response: { use: vi.fn() },
            },
        };

        mockedAxios.create = vi.fn(() => mockAxiosInstance);

        carrier = new UPSCarrier(validConfig);
    });

    describe('Successful Rating Requests', () => {
        it('should successfully get rate quotes for valid request', async () => {
            // Mock auth token
            mockAxiosInstance.post
                .mockResolvedValueOnce(mockTokenResponse)
                .mockResolvedValueOnce(mockSuccessfulRatingResponse);

            const quotes = await carrier.getRates(validRateRequest);

            // Verify we got quotes back
            expect(quotes).toHaveLength(2);

            // Verify first quote (Ground with negotiated rate)
            expect(quotes[0]).toMatchObject({
                carrier: 'UPS',
                service: 'UPS Ground',
                serviceCode: '03',
                serviceLevel: 'GROUND',
                totalCharge: 23.75,
                currency: 'USD',
                deliveryDays: 3,
            });

            // Verify second quote (Second Day Air)
            expect(quotes[1]).toMatchObject({
                carrier: 'UPS',
                service: 'UPS Second Day Air',
                serviceCode: '02',
                serviceLevel: 'SECOND_DAY_AIR',
                totalCharge: 45.0,
                baseCharge: 42.0,
                currency: 'USD',
                deliveryDays: 2,
            });
        });

        it('should handle single rated shipment response', async () => {
            const singleShipmentResponse = {
                data: {
                    RateResponse: {
                        Response: {
                            ResponseStatus: {
                                Code: '1',
                                Description: 'Success',
                            },
                        },
                        RatedShipment: {
                            Service: {
                                Code: '01',
                                Description: 'UPS Next Day Air',
                            },
                            TotalCharges: {
                                CurrencyCode: 'USD',
                                MonetaryValue: '75.00',
                            },
                        },
                    },
                },
            };

            mockAxiosInstance.post
                .mockResolvedValueOnce(mockTokenResponse)
                .mockResolvedValueOnce(singleShipmentResponse);

            const quotes = await carrier.getRates(validRateRequest);

            expect(quotes).toHaveLength(1);
            expect(quotes[0].serviceCode).toBe('01');
            expect(quotes[0].totalCharge).toBe(75.0);
        });

        it('should correctly map request with specific service level', async () => {
            mockAxiosInstance.post
                .mockResolvedValueOnce(mockTokenResponse)
                .mockResolvedValueOnce(mockSuccessfulRatingResponse);

            const requestWithService: RateRequest = {
                ...validRateRequest,
                serviceLevel: 'GROUND',
            };

            await carrier.getRates(requestWithService);

            // Verify the rating request included service code
            const ratingCall = mockAxiosInstance.post.mock.calls[1];
            const requestBody = ratingCall[1];

            expect(requestBody.RateRequest.Shipment.Service).toBeDefined();
            expect(requestBody.RateRequest.Shipment.Service.Code).toBe('03'); // Ground service code
        });

        it('should handle multiple packages', async () => {
            mockAxiosInstance.post
                .mockResolvedValueOnce(mockTokenResponse)
                .mockResolvedValueOnce(mockSuccessfulRatingResponse);

            const multiPackageRequest: RateRequest = {
                ...validRateRequest,
                packages: [
                    { weight: 5, weightUnit: 'LB' },
                    { weight: 10, weightUnit: 'LB' },
                ],
            };

            await carrier.getRates(multiPackageRequest);

            // Verify packages were included
            const ratingCall = mockAxiosInstance.post.mock.calls[1];
            const requestBody = ratingCall[1];

            expect(Array.isArray(requestBody.RateRequest.Shipment.Package)).toBe(true);
            expect(requestBody.RateRequest.Shipment.Package).toHaveLength(2);
        });

        it('should handle residential addresses', async () => {
            mockAxiosInstance.post
                .mockResolvedValueOnce(mockTokenResponse)
                .mockResolvedValueOnce(mockSuccessfulRatingResponse);

            const residentialRequest: RateRequest = {
                ...validRateRequest,
                destination: {
                    ...validRateRequest.destination,
                    residential: true,
                },
            };

            await carrier.getRates(residentialRequest);

            const ratingCall = mockAxiosInstance.post.mock.calls[1];
            const requestBody = ratingCall[1];

            expect(requestBody.RateRequest.Shipment.ShipTo.Address.ResidentialAddressIndicator).toBe('Y');
        });
    });

    describe('Validation Errors', () => {
        it('should reject request with missing origin', async () => {
            const invalidRequest = {
                ...validRateRequest,
                origin: undefined as any,
            };

            await expect(carrier.getRates(invalidRequest)).rejects.toThrow(CarrierValidationError);
        });

        it('should reject request with invalid postal code', async () => {
            const invalidRequest: RateRequest = {
                ...validRateRequest,
                origin: {
                    ...validRateRequest.origin,
                    postalCode: '',
                },
            };

            await expect(carrier.getRates(invalidRequest)).rejects.toThrow(CarrierValidationError);
        });

        it('should reject request with negative weight', async () => {
            const invalidRequest: RateRequest = {
                ...validRateRequest,
                packages: [
                    {
                        weight: -5,
                        weightUnit: 'LB',
                    },
                ],
            };

            await expect(carrier.getRates(invalidRequest)).rejects.toThrow(CarrierValidationError);
        });

        it('should reject request with no packages', async () => {
            const invalidRequest: RateRequest = {
                ...validRateRequest,
                packages: [],
            };

            await expect(carrier.getRates(invalidRequest)).rejects.toThrow(CarrierValidationError);
        });
    });

    describe('Authentication Lifecycle', () => {
        it('should acquire and use auth token', async () => {
            mockAxiosInstance.post
                .mockResolvedValueOnce(mockTokenResponse)
                .mockResolvedValueOnce(mockSuccessfulRatingResponse);

            await carrier.getRates(validRateRequest);

            // Verify token was requested
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                validConfig.tokenUrl,
                'grant_type=client_credentials',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: expect.stringContaining('Basic '),
                    }),
                })
            );

            // Verify token was used in rating request
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/rating/v1/Rate',
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-access-token-123',
                    }),
                })
            );
        });


        describe('Request Building', () => {
            it('should build correct UPS request structure', async () => {
                mockAxiosInstance.post
                    .mockResolvedValueOnce(mockTokenResponse)
                    .mockResolvedValueOnce(mockSuccessfulRatingResponse);

                await carrier.getRates(validRateRequest);

                const ratingCall = mockAxiosInstance.post.mock.calls[1];
                const requestBody = ratingCall[1];

                // Verify structure
                expect(requestBody).toHaveProperty('RateRequest');
                expect(requestBody.RateRequest).toHaveProperty('Request');
                expect(requestBody.RateRequest).toHaveProperty('Shipment');

                // Verify shipper
                expect(requestBody.RateRequest.Shipment.Shipper).toMatchObject({
                    ShipperNumber: validConfig.accountNumber,
                    Address: {
                        City: 'San Francisco',
                        StateProvinceCode: 'CA',
                        PostalCode: '94105',
                        CountryCode: 'US',
                    },
                });

                // Verify destination
                expect(requestBody.RateRequest.Shipment.ShipTo.Address).toMatchObject({
                    City: 'New York',
                    StateProvinceCode: 'NY',
                    PostalCode: '10001',
                    CountryCode: 'US',
                });

                // Verify package
                expect(requestBody.RateRequest.Shipment.Package).toBeDefined();
            });
        });
    });
});