import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Security-focused rules
      "@typescript-eslint/no-explicit-any": "warn", // Changed from error to warn for gradual migration
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "prefer-const": "error",
      "no-var": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      
      // React security
      "react/no-danger": "warn",
      "react/no-danger-with-children": "error",
      "react/no-unescaped-entities": "error",
      
      // General code quality
      "no-console": "off", // Allow console for development
      "no-debugger": "error",
      "no-alert": "off", // Allow alerts in development - TODO: Replace with proper modals
      
      // TypeScript specific (keeping these as warnings to avoid breaking type checking)
      "@typescript-eslint/prefer-nullish-coalescing": "off", // Disable this rule that requires type info
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
    }
  }
];

export default eslintConfig;
