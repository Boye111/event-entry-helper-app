import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The WhatsApp preview route loads sharp with a dynamic import; make sure Vercel ships
  // sharp and its Linux binaries with that function.
  outputFileTracingIncludes: {
    "/api/og/[code]": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
};

export default nextConfig;
