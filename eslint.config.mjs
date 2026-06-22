import next from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config for Next.js 16. `eslint-config-next` ships native flat-config
 * arrays (no FlatCompat needed). Run with `npm run lint`.
 */
const eslintConfig = [
  ...next,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    rules: {
      // Underscore-prefixed args/vars are intentionally unused (e.g. the
      // not-yet-wired SupabaseTaskRepository stub params).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
