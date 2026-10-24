import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([...nextVitals, ...nextTs, globalIgnores([".next/**", "public/demo/**", "playwright-report/**", "test-results/**", "frontend/Journey-Based Audio Learning App/**"])]);
