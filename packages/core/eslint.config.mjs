import tseslint from "typescript-eslint";

export default tseslint.config(
  tseslint.configs.recommended,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toUpperCase']",
          message: "Use toLocaleUpperCase('tr-TR') (or upperTR from the template's format.ts): plain toUpperCase breaks Turkish İ/ı.",
        },
        {
          selector: "CallExpression[callee.property.name='toLowerCase']",
          message: "Use toLocaleLowerCase('tr-TR'): plain toLowerCase breaks Turkish İ/ı.",
        },
      ],
    },
  },
  { ignores: ["dist/**"] },
);
