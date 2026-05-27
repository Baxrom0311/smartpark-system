/**
 * Tests for the login form Zod schemas. These schemas drive both the
 * email and the phone authentication paths, and the regex on the
 * phone field is the only place we enforce a digit-only contact, so
 * it's worth covering explicitly.
 */

import { describe, expect, it } from "vitest";

import {
  loginEmailSchema,
  loginPhoneSchema,
} from "@/lib/validation/login";

describe("login validation schemas", () => {
  it("accepts a well-formed email + 8-char password", () => {
    const parsed = loginEmailSchema.safeParse({
      mode: "email",
      email: "user@sado.uz",
      password: "abcd1234",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed emails", () => {
    const parsed = loginEmailSchema.safeParse({
      mode: "email",
      email: "not-an-email",
      password: "abcd1234",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const parsed = loginEmailSchema.safeParse({
      mode: "email",
      email: "user@sado.uz",
      password: "1234",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a +998 international phone number", () => {
    const parsed = loginPhoneSchema.safeParse({
      mode: "phone",
      phone: "+998901234567",
      password: "abcd1234",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a phone with letters", () => {
    const parsed = loginPhoneSchema.safeParse({
      mode: "phone",
      phone: "abc12345",
      password: "abcd1234",
    });
    expect(parsed.success).toBe(false);
  });
});
