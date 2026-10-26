import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Regla de arquitectura: domain/ nunca importa db, next ni infra
    files: ["src/modules/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/db/*", "@/db", "next/*", "next", "**/infra/*"],
              message: "La capa domain/ debe ser pura: no puede importar la BD, Next.js ni infra/.",
            },
          ],
        },
      ],
    },
  },
  {
    // Regla de arquitectura: app/ nunca importa infra/ directamente
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/infra/*"],
              message: "La capa app/ debe comunicarse con modules/*/application o el index.ts público del módulo, nunca con infra/.",
            },
          ],
        },
      ],
    },
  },
];
