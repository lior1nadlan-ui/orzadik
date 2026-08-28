import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // 256 occurrences, almost all of them a Supabase row narrowed by hand at
      // the call site. Each is a real (small) type hole worth closing, but as
      // an ERROR the rule fails `npm run lint` outright — which is how lint
      // came to be excluded from CI entirely, and with it every rule that DOES
      // catch bugs. A warning keeps the count visible and lets the gate run.
      "@typescript-eslint/no-explicit-any": "warn",
      // `catch {}` around localStorage/JSON.parse is a deliberate pattern here:
      // storage throws in private mode and on a corrupt value, and the correct
      // response in every one of those call sites is to carry on with the
      // default. An empty block anywhere else is still an error.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  eslintPluginPrettier,
);
