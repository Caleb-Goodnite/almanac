"use client";

/** Last-resort error page: it replaces the root layout, so it carries its own minimal styling. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f4f0e8", color: "#1a1814", fontFamily: "Georgia, serif", padding: 24 }}>
        <main>
          <h1 style={{ fontSize: 40, fontWeight: 400, margin: 0 }}>Almanac is having trouble.</h1>
          <p style={{ fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
            Nothing you have logged is lost. Please reload the page.
          </p>
          {/* A full reload is the point here: the app shell itself failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "#b23610", fontFamily: "system-ui, sans-serif" }}>
            Reload
          </a>
        </main>
      </body>
    </html>
  );
}
