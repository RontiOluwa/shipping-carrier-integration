import { describe, it, expect, beforeEach, vi, afterEach, type Mocked } from 'vitest';
import { UPSAuthProvider } from '../../src/carriers/ups/ups-auth';
import { CarrierAuthError } from '../../src/domain/models/error';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('UPSAuthProvider Integration Tests', () => {
    let authProvider: UPSAuthProvider;
    let mockAxiosInstance: any;

    const validConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: 'https://wwwcie.ups.com/security/v1/oauth/token',
    };

    const mockTokenResponse = {
        data: {
            access_token: 'test-access-token-abc123',
            token_type: 'Bearer',
            expires_in: 3600,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup axios mock
        mockAxiosInstance = {
            post: vi.fn(),
        };

        mockedAxios.create = vi.fn(() => mockAxiosInstance);

        authProvider = new UPSAuthProvider(validConfig);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('Token Acquisition', () => {
        it('should successfully acquire access token', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);

            const token = await authProvider.getToken();

            expect(token).toBe('test-access-token-abc123');

            // Verify request format
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                validConfig.tokenUrl,
                'grant_type=client_credentials',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: expect.stringMatching(/^Basic /),
                    }),
                })
            );
        });

        it('should encode credentials correctly in Basic Auth', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);

            await authProvider.getToken();

            const call = mockAxiosInstance.post.mock.calls[0];
            const authHeader = call[2].headers.Authorization;

            // Decode and verify
            const base64Part = authHeader.replace('Basic ', '');
            const decoded = Buffer.from(base64Part, 'base64').toString();

            expect(decoded).toBe(`${validConfig.clientId}:${validConfig.clientSecret}`);
        });

        it('should handle invalid token response', async () => {
            const invalidResponse = {
                data: {
                    // Missing access_token
                    token_type: 'Bearer',
                    expires_in: 3600,
                },
            };

            mockAxiosInstance.post.mockResolvedValueOnce(invalidResponse);

            await expect(authProvider.getToken()).rejects.toThrow(CarrierAuthError);
        });
    });

    describe('Token Caching', () => {
        it('should cache and reuse valid tokens', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);

            // Get token twice
            const token1 = await authProvider.getToken();
            const token2 = await authProvider.getToken();

            expect(token1).toBe(token2);
            // Should only call API once
            expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
            expect(authProvider.hasValidToken()).toBe(true);
        });

        it('should not cache token on failed request', async () => {
            const error = {
                response: {
                    status: 401,
                    data: { error: 'Invalid credentials' },
                },
                isAxiosError: true,
            };

            mockAxiosInstance.post.mockRejectedValueOnce(error);

            await expect(authProvider.getToken()).rejects.toThrow(CarrierAuthError);
            expect(authProvider.hasValidToken()).toBe(false);
        });

        it('should refresh expired token automatically', async () => {
            // Mock short-lived token (1 second)
            const shortLivedToken = {
                data: {
                    access_token: 'short-lived-token',
                    token_type: 'Bearer',
                    expires_in: 1,
                },
            };

            const newToken = {
                data: {
                    access_token: 'new-token',
                    token_type: 'Bearer',
                    expires_in: 3600,
                },
            };

            mockAxiosInstance.post
                .mockResolvedValueOnce(shortLivedToken)
                .mockResolvedValueOnce(newToken);

            // Get initial token
            const token1 = await authProvider.getToken();
            expect(token1).toBe('short-lived-token');

            // Wait for token to expire (plus refresh buffer)
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Should acquire new token
            const token2 = await authProvider.getToken();
            expect(token2).toBe('new-token');
            expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
        });
    });

    describe('Concurrent Request Handling', () => {
        it('should deduplicate concurrent token requests', async () => {
            mockAxiosInstance.post.mockImplementation(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve(mockTokenResponse), 100)
                )
            );

            // Make multiple concurrent requests
            const promises = [
                authProvider.getToken(),
                authProvider.getToken(),
                authProvider.getToken(),
            ];

            const tokens = await Promise.all(promises);

            // All should get same token
            expect(tokens).toEqual([
                'test-access-token-abc123',
                'test-access-token-abc123',
                'test-access-token-abc123',
            ]);

            // Should only make one API call
            expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
        });

        it('should handle concurrent requests with one failure', async () => {
            const error = new Error('Network error');

            mockAxiosInstance.post.mockRejectedValueOnce(error);

            // Make concurrent requests
            const promises = [
                authProvider.getToken(),
                authProvider.getToken(),
            ];

            // Both should fail with same error
            await expect(Promise.all(promises)).rejects.toThrow();
            expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
        });
    });

    describe('Token Refresh', () => {
        it('should force refresh token', async () => {
            mockAxiosInstance.post
                .mockResolvedValueOnce(mockTokenResponse)
                .mockResolvedValueOnce({
                    data: {
                        access_token: 'refreshed-token',
                        token_type: 'Bearer',
                        expires_in: 3600,
                    },
                });

            const token1 = await authProvider.getToken();
            expect(token1).toBe('test-access-token-abc123');

            const token2 = await authProvider.refreshToken();
            expect(token2).toBe('refreshed-token');
            expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
        });

        it('should clear token before refresh', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);

            await authProvider.getToken();
            expect(authProvider.hasValidToken()).toBe(true);

            authProvider.clearToken();
            expect(authProvider.hasValidToken()).toBe(false);
        });
    });

    describe('Token Lifecycle Helpers', () => {
        it('should report time until expiry', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);

            await authProvider.getToken();

            const timeRemaining = authProvider.getTimeUntilExpiry();
            expect(timeRemaining).toBeGreaterThan(0);
            expect(timeRemaining).toBeLessThanOrEqual(3600);
        });

        it('should return 0 for expired token', async () => {
            const expiredToken = {
                data: {
                    access_token: 'expired-token',
                    token_type: 'Bearer',
                    expires_in: 0,
                },
            };

            mockAxiosInstance.post.mockResolvedValueOnce(expiredToken);

            await authProvider.getToken();

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));

            const timeRemaining = authProvider.getTimeUntilExpiry();
            expect(timeRemaining).toBe(0);
        });

        it('should return 0 when no token cached', () => {
            const timeRemaining = authProvider.getTimeUntilExpiry();
            expect(timeRemaining).toBe(0);
        });
    });

    describe('Token Expiry Buffer', () => {
        it('should refresh token before actual expiry', async () => {
            // Token expires in 10 minutes (600 seconds)
            // With 5-minute buffer, should be considered expired after 5 minutes
            const token = {
                data: {
                    access_token: 'buffered-token',
                    token_type: 'Bearer',
                    expires_in: 600,
                },
            };

            mockAxiosInstance.post.mockResolvedValueOnce(token);

            await authProvider.getToken();
            expect(authProvider.hasValidToken()).toBe(true);

            // Token should still be valid (not yet in buffer zone)
            const timeRemaining = authProvider.getTimeUntilExpiry();
            expect(timeRemaining).toBeGreaterThan(300); // More than 5 minutes
        });
    });
});