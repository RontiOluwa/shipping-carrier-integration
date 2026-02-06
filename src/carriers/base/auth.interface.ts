
export interface AuthToken {
    accessToken: string;
    tokenType: string;
    expiresIn: number; // seconds
    expiresAt: number; // Unix timestamp
}
export interface IAuthProvider {

    getToken(): Promise<string>;

    refreshToken(): Promise<string>;

    hasValidToken(): boolean;

    clearToken(): void;
}