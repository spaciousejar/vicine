import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext/Cloudflare build artifacts:
    ".open-next/**",
    ".wrangler/**",
    "certs/**",
    "workers/*.tmp/**",
    // Local scratch/experimental dirs that shouldn't be linted:
    "vicine-test/**",
    "graphify-out/**",
  ]),
])

export default eslintConfig
