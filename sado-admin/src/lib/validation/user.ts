/**
 * Zod schemas for user-management forms in the admin dashboard.
 *
 * These schemas mirror the backend ``UserCreate`` Pydantic model
 * (``sado-api/app/schemas/user.py``) — keep them in lock-step so the
 * client never sends a payload the server will reject.
 */

import { z } from "zod";

const ROLE_VALUES = ["parent", "teacher", "therapist", "admin"] as const;
const LANGUAGE_VALUES = ["uz", "ru", "kk", "en"] as const;

/**
 * Phones in our market are typically `+998` followed by 9 digits, but
 * we accept the more permissive shape the backend allows: 8–20 digits
 * with an optional leading `+`. Spaces and dashes are stripped via the
 * preprocess step so users can paste in any common format.
 */
const phoneInputSchema = z
  .string()
  .transform((value) => value.trim().replace(/[\s-]/g, ""))
  .refine((value) => value === "" || /^\+?[0-9]{8,20}$/.test(value), {
    message: "Phone must be 8–20 digits, optionally starting with +",
  });

export const createUserSchema = z
  .object({
    email: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().email().or(z.literal(""))),
    phone: phoneInputSchema,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    full_name: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    role: z.enum(ROLE_VALUES),
    language: z.enum(LANGUAGE_VALUES),
    is_active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // Backend requires *one* of email/phone — enforce that on the client.
    if (!data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Provide either an email or a phone",
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Provide either an email or a phone",
      });
    }
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;

/**
 * Strip empty optional identifiers so the JSON payload sent to the
 * backend is `{email, ...}` or `{phone, ...}` rather than carrying an
 * empty string — the Pydantic schema rejects empty strings for both.
 */
export interface CreateUserPayload {
  email?: string;
  phone?: string;
  password: string;
  full_name: string;
  role: (typeof ROLE_VALUES)[number];
  language: (typeof LANGUAGE_VALUES)[number];
  is_active: boolean;
}

export function toCreateUserPayload(values: CreateUserValues): CreateUserPayload {
  const payload: CreateUserPayload = {
    password: values.password,
    full_name: values.full_name,
    role: values.role,
    language: values.language,
    is_active: values.is_active,
  };
  if (values.email) payload.email = values.email;
  if (values.phone) payload.phone = values.phone;
  return payload;
}

export const USER_ROLES = ROLE_VALUES;
export const USER_LANGUAGES = LANGUAGE_VALUES;
