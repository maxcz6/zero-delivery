import type { MetadataRoute } from "next";
import { ES_PE } from "@/shared/i18n/es-PE";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: ES_PE.app.name,
    short_name: "ZeroDelivery",
    description: ES_PE.app.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#e11d48",
    lang: "es-PE",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
