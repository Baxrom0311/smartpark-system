/**
 * Tests for the admin user-creation Zod schema.
 *
 * The schema is the only piece of the dialog that contains real
 * branching logic; the dialog component itself is a thin React
 * wrapper around RHF's `useForm` and is best exercised through
 * end-to-end tests later. Keeping these as pure-function tests means
 * they run in a fraction of a second and don't pull in jsdom + React
 * just to validate field-level rules.
 */

import { describe, expect, it } from "vitest";

import {
  createUserSchema,
  toCreateUserPayload,
  type CreateUserValues,
} from "@/lib/validation/user";

const VALID: CreateUserValues = {
  email: "new.therapist@sado.uz",
  phone: "",
  password: "Sup3r-Secret!",
  full_name: "Created Therapist",
  role: "therapist",
  language: "ru",
  is_active: true,
};

describe("createUserSchema", () => {
  it("accepts a fully populated email-only payload", () => {
    const parsed = createUserSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
  });

  it("accepts a phone-only payload (no email)", () => {
    const parsed = createUserSchema.safeParse({
      ...VALID,
      email: "",
      phone: "+998901234567",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects when both email and phone are blank", () => {
    const parsed = createUserSchema.safeParse({
      ...VALID,
      email: "",
      phone: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("email");
      expect(paths).toContain("phone");
    }
  });

  it("rejects malformed emails", () => {
    const parsed = createUserSchema.safeParse({
      ...VALID,
      email: "not-an-email",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const parsed = createUserSchema.safeParse({
      ...VALID,
      password: "1234",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown roles", () => {
    const parsed = createUserSchema.safeParse({
      ...VALID,
      // Cast intentionally — the schema is the runtime guard.
      role: "ceo" as unknown as CreateUserValues["role"],
    });
    expect(parsed.success).toBe(false);
  });

  it("strips spaces and dashes from phone numbers", () => {
    const parsed = createUserSchema.safeParse({
      ...VALID,
      email: "",
      phone: "+998 90 123-45-67",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("+998901234567");
    }
  });

  it("rejects phones containing letters", () => {
    const parsed = createUserSchema.safeParse({
      ...VALID,
      email: "",
      phone: "abc123456",
    });
    expect(parsed.success).toBe(false);
  });

  it("trims whitespace around full_name and email", () => {
    const parsed = createUserSchema.safeParse({
      ...VALID,
      email: "  spaced@sado.uz  ",
      full_name: "  Padded Name  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("spaced@sado.uz");
      expect(parsed.data.full_name).toBe("Padded Name");
    }
  });
});

describe("toCreateUserPayload", () => {
  it("omits an empty email and phone from the JSON payload", () => {
    const payload = toCreateUserPayload({
      ...VALID,
      email: "",
      phone: "+998901234567",
    });
    expect(payload).not.toHaveProperty("email");
    expect(payload.phone).toBe("+998901234567");
  });

  it("omits an empty phone when only email is set", () => {
    const payload = toCreateUserPayload(VALID);
    expect(payload.email).toBe(VALID.email);
    expect(payload).not.toHaveProperty("phone");
  });

  it("preserves the role, language and active flag", () => {
    const payload = toCreateUserPayload({
      ...VALID,
      role: "admin",
      language: "kk",
      is_active: false,
    });
    expect(payload.role).toBe("admin");
    expect(payload.language).toBe("kk");
    expect(payload.is_active).toBe(false);
  });
});
