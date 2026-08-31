import { afterEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_OWNER_EMAIL,
  isOwnerEmail,
  ownerEmail,
} from "./access";

const originalOwnerEmail = process.env.AILHAT_OWNER_EMAIL;

afterEach(() => {
  if (originalOwnerEmail === undefined) delete process.env.AILHAT_OWNER_EMAIL;
  else process.env.AILHAT_OWNER_EMAIL = originalOwnerEmail;
});

describe("owner authorization boundary", () => {
  test("uses the configured founder email case-insensitively", () => {
    process.env.AILHAT_OWNER_EMAIL = "  Founder@Example.com ";
    expect(ownerEmail()).toBe("founder@example.com");
    expect(isOwnerEmail("FOUNDER@example.com")).toBe(true);
    expect(isOwnerEmail("member@example.com")).toBe(false);
  });

  test("falls back to the explicit default owner", () => {
    delete process.env.AILHAT_OWNER_EMAIL;
    expect(ownerEmail()).toBe(DEFAULT_OWNER_EMAIL);
    expect(isOwnerEmail(DEFAULT_OWNER_EMAIL.toUpperCase())).toBe(true);
  });
});
