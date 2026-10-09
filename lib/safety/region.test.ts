import { describe, expect, it } from "vitest";
import { countryFrom, regionAllowed } from "./region";

const h = (init: Record<string, string>) => new Headers(init);

describe("launch region", () => {
  it("reads the country from common platform headers", () => {
    expect(countryFrom(h({ "x-vercel-ip-country": "us" }))).toBe("US");
    expect(countryFrom(h({ "cf-ipcountry": "DE" }))).toBe("DE");
    expect(countryFrom(h({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(countryFrom(h({}))).toBeNull();
  });
  it("allows only listed countries when the country is known", () => {
    expect(regionAllowed(h({ "x-vercel-ip-country": "US" }), "US")).toBe(true);
    expect(regionAllowed(h({ "x-vercel-ip-country": "DE" }), "US")).toBe(false);
    expect(regionAllowed(h({ "x-vercel-ip-country": "CA" }), "US, CA")).toBe(true);
    expect(regionAllowed(h({ "x-vercel-ip-country": "FR" }), "*")).toBe(true);
  });
  it("does not restrict when the platform provides no country", () => {
    expect(regionAllowed(h({}), "US")).toBe(true);
  });
});
