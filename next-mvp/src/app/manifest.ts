import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "課題管理",
    short_name: "課題",
    description: "個人課題とクラス課題を、締切通知つきで管理するモバイルファーストPWA",
    start_url: "/app/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1C1C1E",
    theme_color: "#1C1C1E",
    lang: "ja",
    categories: ["productivity", "education"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "今日のタスク",
        short_name: "今日",
        url: "/app/today",
      },
      {
        name: "予定",
        short_name: "予定",
        url: "/app/upcoming",
      },
    ],
  };
}
