import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!supabaseUrl) return [];
    return [
      {
        source: '/api/supabase/:path*',
        destination: `${supabaseUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
