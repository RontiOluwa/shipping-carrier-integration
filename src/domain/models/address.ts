import { z } from 'zod';

export const AddressSchema = z.object({
    street1: z.string().min(1, 'Street address is required'),
    street2: z.string().optional(),
    street3: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(2).max(2).optional(),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().length(2, 'Country must be 2-letter ISO code'),
    residential: z.boolean().default(false).optional(),
});

export type Address = z.infer<typeof AddressSchema>;

export function validateAddress(address: unknown): Address {
    return AddressSchema.parse(address);
}

// ✅ Fixed: Remove explicit return type
export function safeValidateAddress(address: unknown) {
    return AddressSchema.safeParse(address);
}