import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/production/anomaly",
        destination: "/qa",
        permanent: true,
      },
      {
        source: "/admin/production/anomaly/report",
        destination: "/qa/report",
        permanent: true,
      },
      {
        source: "/admin/production/anomaly/records",
        destination: "/qa/records",
        permanent: true,
      },
      {
        source: "/admin/production/anomaly/options",
        destination: "/qa/options",
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
