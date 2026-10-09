import type { MetadataRoute } from "next";

/** Public pages may be indexed. Everything behind sign-in, and every API route, may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/research", "/privacy", "/terms"],
        disallow: ["/api/", "/today", "/food", "/train", "/body", "/trends", "/coach", "/settings", "/support", "/welcome", "/reset-password", "/styleguide"],
      },
    ],
  };
}
