import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "課題管理MVP",
    short_name: "課題MVP",
    description: "個人課題と共有課題を一元管理するPWA",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4ef",
    theme_color: "#185a9d",
    lang: "ja",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/x-icon",
      },
    ],
  };
}
