/** @type {import('next').NextConfig} */
const apiOrigin = process.env.BIZING_API_ORIGIN || "http://localhost:6129";

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      {
        // API explorer includes process-level health endpoints in addition to
        // versioned `/api/*` routes. Proxy `/health*` so the explorer can run
        // those checks from the admin origin without CORS/config surprises.
        source: "/health",
        destination: `${apiOrigin}/health`,
      },
      {
        source: "/health/:path*",
        destination: `${apiOrigin}/health/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
