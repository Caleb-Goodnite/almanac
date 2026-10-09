import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Almanac",
    short_name: "Almanac",
    description: "A calm, evidence-based record of what you eat, how you train, and how you recover.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f0e8",
    theme_color: "#f4f0e8",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log food", url: "/food/add" },
      { name: "Start a workout", url: "/train" },
      { name: "Check in", url: "/body" },
    ],
  };
}
