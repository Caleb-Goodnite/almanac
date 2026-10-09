import { beforeAll, describe, expect, it } from "vitest";
import { checkDateOfBirth, issueAgeToken, readCookie, verifyAgeToken } from "./age-gate";

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
});

const today = { year: 2026, month: 10, day: 9 };

describe("age gate", () => {
  it("blocks anyone under 13, to the day", () => {
    expect(checkDateOfBirth("2013-10-10", today)).toEqual({ ok: false, reason: "under_age" });
    expect(checkDateOfBirth("2020-01-01", today)).toEqual({ ok: false, reason: "under_age" });
  });

  it("admits someone on their 13th birthday and keeps only month and year", () => {
    expect(checkDateOfBirth("2013-10-09", today)).toEqual({
      ok: true,
      age: 13,
      claim: { birthYear: 2013, birthMonth: 10 },
    });
  });

  it("rejects impossible or absurd dates instead of guessing", () => {
    expect(checkDateOfBirth("2010-02-30", today)).toEqual({ ok: false, reason: "invalid" });
    expect(checkDateOfBirth("2030-01-01", today)).toEqual({ ok: false, reason: "invalid" });
    expect(checkDateOfBirth("1850-01-01", today)).toEqual({ ok: false, reason: "invalid" });
    expect(checkDateOfBirth("not-a-date", today)).toEqual({ ok: false, reason: "invalid" });
  });

  it("round-trips a signed token", () => {
    const token = issueAgeToken({ birthYear: 2010, birthMonth: 3 });
    expect(verifyAgeToken(token)).toEqual({ birthYear: 2010, birthMonth: 3 });
  });

  it("rejects forged, altered, expired and missing tokens", () => {
    const now = Date.now();
    const token = issueAgeToken({ birthYear: 2015, birthMonth: 3 }, now);
    const [y, m, exp, mac] = token.split(".");
    expect(verifyAgeToken(`1990.${m}.${exp}.${mac}`)).toBeNull();
    expect(verifyAgeToken(`${y}.${m}.${Number(exp) + 9999}.${mac}`)).toBeNull();
    expect(verifyAgeToken("2000.1.9999999999.forged")).toBeNull();
    expect(verifyAgeToken(token, now + 2 * 60 * 60 * 1000)).toBeNull();
    expect(verifyAgeToken(undefined)).toBeNull();
    expect(verifyAgeToken("")).toBeNull();
  });

  it("reads a named cookie from a header", () => {
    expect(readCookie("a=1; almanac_age=abc.def; b=2", "almanac_age")).toBe("abc.def");
    expect(readCookie("a=1", "almanac_age")).toBeUndefined();
    expect(readCookie(null, "almanac_age")).toBeUndefined();
  });
});
