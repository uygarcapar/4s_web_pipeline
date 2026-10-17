import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Strict accessibility rules on all JSX. eslint-config-next already
  // registers the jsx-a11y plugin, so only the strict rule set is applied
  // here (re-registering the plugin is a flat-config error).
  {
    files: ["**/*.{jsx,tsx}"],
    rules: { ...jsxA11y.flatConfigs.strict.rules },
  },
  {
    rules: {
      // Turkish casing (dotted/dotless i) breaks with the default locale:
      // "istanbul".toUpperCase() === "ISTANBUL" (wrong, must be "İSTANBUL").
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toUpperCase']",
          message:
            "Use upperTR from @/lib/format instead of toUpperCase() — Turkish casing requires the tr-TR locale.",
        },
        {
          selector: "CallExpression[callee.property.name='toLowerCase']",
          message:
            "Use lowerTR from @/lib/format instead of toLowerCase() — Turkish casing requires the tr-TR locale.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
