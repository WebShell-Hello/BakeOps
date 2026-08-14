import type { NextConfig } from "next";

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const apiBaseUrl = process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000/api/v1";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBaseUrl}/:path*/`,
      },
    ];
  },
};

export default nextConfig;
