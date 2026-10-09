import { beforeAll, describe, expect, it } from "vitest";
import { MAX_SESSION_SECONDS, MIN_READ_SECONDS, maskEmail, phraseMatches, sameMailbox } from "./guardian";
import { checkStartStamp, hashToken, issueStartStamp, newToken } from "./guardian-token";

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";
});

describe("guardian approval", () => {
  it("accepts the phrase regardless of case, spacing or a final full stop, and nothing else", () => {
    expect(phraseMatches("I understand the risks")).toBe(true);
    expect(phraseMatches("  i UNDERSTAND  the risks. ")).toBe(true);
    expect(phraseMatches("I understand")).toBe(false);
    expect(phraseMatches("I understand the risk")).toBe(false);
    expect(phraseMatches("")).toBe(false);
  });

  it("treats plus-tags and Gmail dots as the same mailbox", () => {
    expect(sameMailbox("Sam@Example.com", "sam+mum@example.com")).toBe(true);
    expect(sameMailbox("s.a.m@gmail.com", "sam@googlemail.com")).toBe(true);
    expect(sameMailbox("s.am@example.com", "sam@example.com")).toBe(false);
    expect(sameMailbox("sam@example.com", "pat@example.com")).toBe(false);
  });

  it("masks an address down to its first letter and domain", () => {
    expect(maskEmail("pat.lee@example.com")).toBe("p•••@example.com");
  });

  it("issues unguessable tokens and stores only a hash", () => {
    const a = newToken();
    expect(a).not.toBe(newToken());
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });

  it("refuses an approval that arrives too soon, too late, forged, or for another request", () => {
    const hash = hashToken("one");
    const t0 = 1_800_000_000_000;
    const stamp = issueStartStamp(hash, t0);
    expect(checkStartStamp(stamp, hash, t0 + 1000)).toBe("too_soon");
    expect(checkStartStamp(stamp, hash, t0 + MIN_READ_SECONDS * 1000)).toBe("ok");
    expect(checkStartStamp(stamp, hash, t0 + (MAX_SESSION_SECONDS + 1) * 1000)).toBe("expired");
    expect(checkStartStamp(stamp, hashToken("two"), t0 + 60_000)).toBe("invalid");
    expect(checkStartStamp(`${t0 - 60_000}.${stamp.split(".")[1]}`, hash, t0 + 60_000)).toBe("invalid");
    expect(checkStartStamp("garbage", hash, t0)).toBe("invalid");
  });
});
