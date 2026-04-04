import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

export const { GET } = createFromSource(source, {
  // Using English for both locales as Chinese requires @orama/tokenizers
  // TODO: Add @orama/tokenizers package for proper Chinese search support
  // https://fumadocs.dev/docs/headless/search/orama#language-stemmer
  localeMap: {
    en: { language: "english" },
    zh: { language: "english" }, // Use English tokenizer for now
  },
});
