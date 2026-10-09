import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native apps are a thin shell: a web view that opens the deployed site.
 * Almanac renders on the server, so there is no static bundle to ship inside
 * the app. `mobile/www` holds only the page shown when the site cannot be
 * reached.
 *
 * To point a build at another server (a preview deployment, or a dev machine
 * on the same Wi-Fi) set CAP_SERVER_URL before `pnpm mobile:sync`.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://health.anchorforgedigital.com";
const { hostname, protocol } = new URL(serverUrl);

const config: CapacitorConfig = {
  appId: "com.anchorforgedigital.almanac",
  appName: "Almanac",
  webDir: "mobile/www",
  // Lets the server tell the app from a browser (it hides Google sign-in, which Google blocks in web views).
  appendUserAgent: "AlmanacApp",
  backgroundColor: "#f4f0e8",
  server: {
    url: serverUrl,
    cleartext: protocol === "http:",
    allowNavigation: [hostname],
    errorPath: "index.html",
  },
  android: { allowMixedContent: false },
};

export default config;
