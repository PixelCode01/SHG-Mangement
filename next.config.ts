import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // V9 - Ultimate cache bust + unrestricted CSP
  generateBuildId: async () => {
    return `v9-ultimate-cache-bust-${Date.now()}`;
  },
  // API route configuration for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  },
  eslint: {
    // Remove this in production - currently allows builds with ESLint errors
    ignoreDuringBuilds: false, // Changed to false for better code quality
  },
  // Security headers + CACHE BUSTING V6
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src * 'unsafe-inline' 'unsafe-eval'; worker-src * blob: data:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src *; connect-src *; frame-ancestors 'none';",
          },
        ],
      },
    ]
  },
  // Optimize for production
  poweredByHeader: false,
  compress: true,
  webpack: (config, { buildId: _buildId, dev: _dev, isServer: _isServer, defaultLoaders: _defaultLoaders, webpack: _webpack }) => {
    // Add the CopyPlugin to copy the pdf.worker.mjs file
    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: path.join(
              path.dirname(require.resolve('pdfjs-dist/package.json')),
              'build/pdf.worker.mjs'
            ),
            to: path.join(__dirname, 'public'),
          },
        ],
      })
    );

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
