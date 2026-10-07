import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 80, 85, 90],
    localPatterns: [{ pathname: "/brand/**" }, { pathname: "/media/public/**" }],
    remotePatterns: [
      ...(process.env.S3_PUBLIC_URL ? [new URL(`${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/**`)] : []),
      // Public images when STORAGE_DRIVER=cloudinary
      new URL("https://res.cloudinary.com/**"),
    ],
  },
  serverExternalPackages: ["sharp"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
