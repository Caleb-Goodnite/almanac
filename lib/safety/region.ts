/**
 * Launch region. Almanac's helplines, age threshold and wording are written
 * for the United States, so sign-up is limited to the countries listed in
 * ALLOWED_COUNTRIES (default "US").
 *
 * The country comes from a header set by the hosting platform. That is a
 * best-effort signal: a VPN defeats it, and where no such header exists
 * (local development, some hosts) sign-up is not restricted at all. It keeps
 * the app from being offered where its safety content would be wrong; it is
 * not an access control.
 */
const GEO_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "cloudfront-viewer-country", "x-country-code"];

export function countryFrom(headers: Headers): string | null {
  for (const name of GEO_HEADERS) {
    const value = headers.get(name)?.trim().toUpperCase();
    // "XX" and "T1" are Cloudflare's codes for unknown and Tor.
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX") return value;
  }
  return null;
}

export function regionAllowed(headers: Headers, allowed = process.env.ALLOWED_COUNTRIES ?? "US"): boolean {
  const country = countryFrom(headers);
  if (!country) return true;
  const list = allowed.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  return list.length === 0 || list.includes("*") || list.includes(country);
}
