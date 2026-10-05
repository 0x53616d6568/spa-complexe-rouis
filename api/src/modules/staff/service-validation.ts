import { z } from "@workspace/api-zod";

export const serviceBody = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(80),
  shortDescription: z.string().min(2).max(300),
  description: z.string().min(2).max(2000),
  durationMinutes: z.number().int().min(1).max(600),
  priceAmount: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(100).optional(),
  currency: z.string().length(3),
  isFeatured: z.boolean().optional(),
  imageUrl: z.union([z.string().max(50000000), z.literal(""), z.null()])
    .optional()
    .transform((value) => !value || value.trim() === "" ? null : value.trim()),
});

export const updateServiceBody = serviceBody
  .partial()
  .extend({ isActive: z.boolean().optional() });
