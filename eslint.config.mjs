import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";
import globals from "globals";

export default [
  {
    // samsung-tv/ is a separate ES5 app with its own conventions
    ignores: ["dist/**", "dev-dist/**", "node_modules/**", "samsung-tv/**"],
  },
  js.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  skipFormatting,
  {
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "vue/multi-word-component-names": 0,
    },
  },
];
