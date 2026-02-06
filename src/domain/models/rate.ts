import { z } from 'zod';
import { AddressSchema } from './address';
import { PackageSchema } from './package';

export const ServiceLevelSchema = z.enum([
    'GROUND',
    'NEXT_DAY_AIR',
    'NEXT_DAY_AIR_SAVER',
    'SECOND_DAY_AIR',
    'SECOND_DAY_AIR_AM',
    'THREE_DAY_SELECT',
    'EXPRESS',
    'EXPRESS_PLUS',
    'STANDARD',
]);

export type ServiceLevel = z.infer<typeof ServiceLevelSchema>;

export const RateRequestSchema = z.object({
    origin: AddressSchema,
    destination: AddressSchema,
    packages: z.array(PackageSchema).min(1, 'At least one package required'),
    serviceLevel: ServiceLevelSchema.optional(),
    shipmentDate: z.date().optional(),
    pickupType: z.enum(['DAILY_PICKUP', 'ONE_TIME_PICKUP', 'DROP_OFF']).optional(),
    paymentType: z.enum(['SENDER', 'RECEIVER', 'THIRD_PARTY']).default('SENDER').optional(),
});

export type RateRequest = z.infer<typeof RateRequestSchema>;

export const RateQuoteSchema = z.object({
    carrier: z.string(),
    service: z.string(),
    serviceCode: z.string(),
    serviceLevel: ServiceLevelSchema.optional(),
    totalCharge: z.number().nonnegative(),
    baseCharge: z.number().nonnegative().optional(),
    currency: z.string().length(3).default('USD'),
    deliveryDate: z.date().optional(),
    deliveryDays: z.number().int().positive().optional(),
    guaranteedDelivery: z.boolean().optional().default(false),
    rateId: z.string().optional(),
    disclaimer: z.string().optional(),
    additionalCharges: z.array(z.object({
        type: z.string(),
        amount: z.number(),
    })).optional(),
});

export type RateQuote = z.infer<typeof RateQuoteSchema>;

export function validateRateRequest(request: unknown): RateRequest {
    return RateRequestSchema.parse(request);
}

export function validateRateQuote(quote: unknown): RateQuote {
    return RateQuoteSchema.parse(quote);
}

// ✅ Fixed: Remove explicit return type
export function safeValidateRateRequest(request: unknown) {
    return RateRequestSchema.safeParse(request);
}