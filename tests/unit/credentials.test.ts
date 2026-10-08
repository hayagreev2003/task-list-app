import { describe, expect, it } from "vitest";
import { normaliseEmail, parseEmailLinkType, validateEmail, validateNewPassword } from "@/lib/credentials";

describe("normaliseEmail", () => {
  it("trims whitespace and handles missing values", () => {
    expect(normaliseEmail("  a@b.co  ")).toBe("a@b.co");
    expect(normaliseEmail(null)).toBe("");
  });
});

describe("validateEmail", () => {
  it("accepts a normal address", () => {
    expect(validateEmail("you@example.com")).toBeNull();
  });

  it("asks for an email when empty", () => {
    expect(validateEmail("")).toBe("Enter your email address.");
  });

  it.each(["plainaddress", "a@b", "a b@c.com", "@example.com", `${"x".repeat(250)}@a.com`])(
    "rejects %s",
    (email) => {
      expect(validateEmail(email)).toBe("Enter a valid email address.");
    },
  );
});

describe("validateNewPassword", () => {
  it("accepts a matching password of 8+ characters", () => {
    expect(validateNewPassword("correct horse", "correct horse")).toBeNull();
  });

  it("requires a password", () => {
    expect(validateNewPassword("", "")).toBe("Enter a password.");
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(validateNewPassword("short12", "short12")).toBe("Use a password of at least 8 characters.");
  });

  it("rejects passwords longer than 72 bytes, counting multi-byte characters", () => {
    const tooLong = "é".repeat(37); // 74 bytes, 37 characters
    expect(validateNewPassword(tooLong, tooLong)).toBe("Use a password of at most 72 characters.");
  });

  it("rejects a confirmation that doesn't match", () => {
    expect(validateNewPassword("password-one", "password-two")).toBe("The passwords don't match.");
  });
});

describe("parseEmailLinkType", () => {
  it.each(["email", "signup", "magiclink"])("accepts %s", (type) => {
    expect(parseEmailLinkType(type)).toBe(type);
  });

  it.each([null, "", "recovery", "invite", "EMAIL"])("rejects %s", (type) => {
    expect(parseEmailLinkType(type)).toBeNull();
  });
});
