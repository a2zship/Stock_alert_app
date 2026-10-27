import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Đón Hộ",
    short_name: "Đón Hộ",
    description: "Nhờ người đón con, có xác nhận của phụ huynh, người đón và giáo viên",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6fb",
    theme_color: "#1e1b4b",
    lang: "vi",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
