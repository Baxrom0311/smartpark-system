/**
 * Zod schemas for the login form. Lifted out of the route so they can
 * be reused by tests and (later) by an API smoke check that mirrors
 * the same validation rules.
 */

import { z } from "zod";

export const loginEmailSchema = z.object({
  mode: z.literal("email"),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginPhoneSchema = z.object({
  mode: z.literal("phone"),
  phone: z
    .string()
    .min(8)
    .regex(/^\+?[0-9\s-]{8,20}$/, "Invalid phone"),
  password: z.string().min(8),
});

export type LoginEmailValues = z.infer<typeof loginEmailSchema>;
export type LoginPhoneValues = z.infer<typeof loginPhoneSchema>;
export type LoginFormValues = LoginEmailValues | LoginPhoneValues;
