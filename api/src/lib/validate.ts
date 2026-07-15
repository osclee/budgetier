import { z } from "zod";

export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "month must be formatted YYYY-MM");

export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

const kindSchema = z.enum([
  "income",
  "deduction",
  "need",
  "investment",
  "giving",
  "savings",
  "discretionary",
]);

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  kind: kindSchema,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex like #aabbcc")
    .default("#94a3b8"),
  sortOrder: z.number().int().default(0),
  countsAsInvestment: z.boolean().default(false),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const transactionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  description: z.string().min(1).max(300),
  amount: z.number().finite(),
  categoryId: z.string().min(1),
});

export const transactionUpdateSchema = transactionCreateSchema.partial();

export const budgetUpsertSchema = z.object({
  yearMonth: yearMonthSchema,
  categoryId: z.string().min(1),
  planned: z.number().finite(),
});

export const insightsMonthsSchema = z.coerce.number().int().min(1).max(12).default(6);

export const recurringCreateSchema = z.object({
  description: z.string().min(1).max(300),
  amount: z.number().finite(),
  categoryId: z.string().min(1),
  dayOfMonth: z.number().int().min(1).max(31),
  active: z.boolean().default(true),
});

export const recurringUpdateSchema = recurringCreateSchema.partial();

export const recurringApplySchema = z.object({
  yearMonth: yearMonthSchema,
});

/** Derive the "YYYY-MM" partition key from a "YYYY-MM-DD" date string. */
export function yearMonthOf(date: string): string {
  return date.slice(0, 7);
}
