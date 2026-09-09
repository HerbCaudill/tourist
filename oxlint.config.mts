import { createRecommendedOxlintConfig } from "@herbcaudill/eslint-plugin"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [
    createRecommendedOxlintConfig({
      exportFileExceptions: { frameworkFilePatterns: ["playwright.config.ts"] },
      testStoryFileExceptions: { frameworkFilePatterns: ["e2e/**"] },
    }),
  ],
})
