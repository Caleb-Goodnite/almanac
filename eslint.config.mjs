import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Data isolation boundary: only the data-access layer, auth, and database
    // scripts may hold a raw database handle. Everything else goes through
    // lib/data, whose functions all require the signed-in user's id.
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/data/**", "lib/auth/**", "lib/db/**", "instrumentation.ts", "tests/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/client", "@/lib/db/connect", "**/db/client", "**/db/connect"],
              message: "Query user data through lib/data so every query is scoped to a user id.",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "lib/db/migrations/**", "android/**", "ios/**", "mobile/**"]),
]);

export default eslintConfig;
