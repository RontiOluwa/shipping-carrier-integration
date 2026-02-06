import { z } from 'zod';

export const WeightUnitSchema = z.enum(['LB', 'KG', 'OZ']);
export type WeightUnit = z.infer<typeof WeightUnitSchema>;


export const DimensionUnitSchema = z.enum(['IN', 'CM']);
export type DimensionUnit = z.infer<typeof DimensionUnitSchema>;


export const DimensionsSchema = z.object({
    length: z.number().positive('Length must be positive'),
    width: z.number().positive('Width must be positive'),
    height: z.number().positive('Height must be positive'),
    unit: DimensionUnitSchema,
});

export type Dimensions = z.infer<typeof DimensionsSchema>;


export const PackageSchema = z.object({
    weight: z.number().positive('Weight must be positive'),
    weightUnit: WeightUnitSchema,
    dimensions: DimensionsSchema.optional(),
    insuredValue: z.number().nonnegative().optional(),
    currency: z.string().length(3).default('USD').optional(), // ISO 4217
    referenceNumber: z.string().optional(),
});

export type Package = z.infer<typeof PackageSchema>;


export function validatePackage(pkg: unknown): Package {
    return PackageSchema.parse(pkg);
}

export function validatePackages(packages: unknown): Package[] {
    const schema = z.array(PackageSchema).min(1, 'At least one package is required');
    return schema.parse(packages);
}