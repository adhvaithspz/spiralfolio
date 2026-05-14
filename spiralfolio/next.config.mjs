/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pdf-parse', 'mammoth', '@libsql/client'],
    // Disable the client-side Router Cache. Next.js 14.2+ holds rendered
    // route segments in browser memory for ~30 s (dynamic) / 5 min (static)
    // even when the page is `force-dynamic`. Setting both to 0 makes every
    // navigation re-fetch from the server, which is what we want for a
    // dashboard that mutates frequently (DB resets, transcript ingestion,
    // brain updates, etc.).
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  webpack: config => {
    config.externals = config.externals || [];
    config.externals.push({ 'better-sqlite3': 'commonjs better-sqlite3' });
    return config;
  },
};

export default nextConfig;
