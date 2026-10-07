import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { env: { DB_PATH: ':memory:', SALESFORCE_ENABLED: 'false', MIN_FORM_MS: '0', TRUST_PROXY: 'true', GEMINI_API_KEY: 'test-key-not-used-0000' } },
})
