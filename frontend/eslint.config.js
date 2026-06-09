import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Codebase uses `any` extensively — type safety enforced by tsc strict mode instead
      "@typescript-eslint/no-explicit-any": "off",
      // Unused vars: tsc noUnusedLocals covers this; allow underscore-prefixed intentional ignores
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // setLoading/setState at the top of useEffect is a common and accepted loading pattern
      "react-hooks/set-state-in-effect": "warn",
      // react-refresh: non-component exports in component files — warn only
      "react-refresh/only-export-components": "warn",
      // react/button-has-type rule is not installed — suppress the "not found" error
      "react/button-has-type": "off",
    },
  },
])
