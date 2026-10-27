import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "on-primary": "var(--color-on-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        "on-accent": "var(--color-on-accent)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: "var(--color-card)",
        "card-foreground": "var(--color-card-foreground)",
        muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-foreground)",
        border: "var(--color-border)",
        destructive: "var(--color-destructive)",
        "on-destructive": "var(--color-on-destructive)",
        ring: "var(--color-ring)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        yape: "var(--color-yape)",
        "success-soft": "var(--color-success-soft)",
        "warning-soft": "var(--color-warning-soft)",
        "accent-soft": "var(--color-accent-soft)",
        "info-soft": "var(--color-info-soft)",
        "yape-soft": "var(--color-yape-soft)",
        "danger-soft": "var(--color-danger-soft)",
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        xs: "var(--shadow-sm)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      borderRadius: {
        card: "var(--radius-lg)",
        modal: "var(--radius-xl)",
      },
    },
  },
  plugins: [],
};

export default config;
