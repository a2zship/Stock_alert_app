import type { NextConfig } from "next";

const publicHost = (() => {
  try {
    return process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Chỉ bật khi đóng gói Docker (Dockerfile đặt BUILD_STANDALONE=1); chạy local vẫn dùng `next start` như cũ.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb", // ảnh chân dung đã thu nhỏ ở trình duyệt (~200 KB), chừa dư
      allowedOrigins: publicHost ? [publicHost] : [],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
    ] }];
  },
};

export default nextConfig;
