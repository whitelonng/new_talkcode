import { defineI18n } from "fumadocs-core/i18n";

export const i18n = defineI18n({
  defaultLanguage: "en",
  languages: ["en", "zh"],
  parser: "dir", // Use directory-based locale structure (content/docs/en/, content/docs/zh/)
  hideLocale: "default-locale", // Hide /en prefix for default language
});
