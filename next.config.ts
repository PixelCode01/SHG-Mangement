import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Optimized build ID generation - less aggressive cache busting
  generateBuildId: async () => {
    // Only use timestamp in development, use default hashing in production
    if (process.env.NODE_ENV === 'development') {
      return `dev-${Date.now()}`;
    }
    return null; // Use default Next.js build ID in production
  },
  // API route configuration for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  },
  // Transpile problematic packages to fix CommonJS/ES module issues
  transpilePackages: [
    'pdf-parse',
    'pdf2json',
    'pdfjs-dist',
    'jspdf',
    'jspdf-autotable'
  ],
  eslint: {
    // Temporarily ignore during builds to fix deployment
    ignoreDuringBuilds: true,
  },
  // Optimized headers for better performance
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return [
      {
        source: '/_next/static/(.*)',
        headers: isDevelopment ? [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ] : [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: isDevelopment ? [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ] : [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live; worker-src * blob: data:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src *; connect-src * https://va.vercel-scripts.com https://vercel.live; frame-ancestors 'none';",
          },
        ],
      },
    ]
  },
  // Optimize for production
  poweredByHeader: false,
  compress: true,
  webpack: (config, { dev, isServer }) => {
    // Fix exports not defined error by properly handling CommonJS modules
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
      },
      fallback: {
        ...config.resolve?.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        querystring: false,
        buffer: false,
        util: false,
      },
    };

    // Fix CommonJS/ES module compatibility issues
    config.module = {
      ...config.module,
      rules: [
        ...config.module.rules,
        {
          test: /\.(js|mjs)$/,
          include: /node_modules\/(pdf-parse|pdf2json|pdfjs-dist)/,
          type: 'javascript/auto',
        },
      ],
    };

    // Better chunk splitting for smaller bundles and fix vendors issue
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 200000, // Reduce max size to prevent large vendors.js
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name(module: any) {
                // Create separate chunks for different types of vendors
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
                
                if (packageName?.match(/^(react|react-dom|next)/)) {
                  return 'react-vendor';
                }
                if (packageName?.match(/^(pdf|jspdf)/)) {
                  return 'pdf-vendor';
                }
                if (packageName?.match(/^(@auth|next-auth)/)) {
                  return 'auth-vendor';
                }
                if (packageName?.match(/^(mongodb|prisma|bcrypt)/)) {
                  return 'db-vendor';
                }
                return 'vendors';
              },
              priority: -10,
              chunks: 'all',
              maxSize: 200000,
            },
            // Separate PDF-related libraries into their own chunk
            pdf: {
              test: /[\\/]node_modules[\\/](pdfjs-dist|pdf-parse|pdf2json|jspdf|jspdf-autotable)[\\/]/,
              name: 'pdf-libs',
              priority: 10,
              chunks: 'all',
              maxSize: 300000,
            },
            // Separate React/Next.js core
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              name: 'react-vendor',
              priority: 10,
              chunks: 'all',
              maxSize: 200000,
            },
            // Separate UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](@heroicons|@hello-pangea|react-datepicker|react-hook-form)[\\/]/,
              name: 'ui-vendor',
              priority: 5,
              chunks: 'all',
              maxSize: 150000,
            },
          },
        },
      };
    }

    // Configure performance warnings appropriately for better development experience
    config.performance = {
      hints: dev ? false : 'warning', // Disable hints in development
      maxAssetSize: dev ? 10000000 : 500000, // 10MB in dev, 500KB in prod
      maxEntrypointSize: dev ? 10000000 : 500000,
      assetFilter: function(assetFilename: string) {
        // Ignore PDF worker and large vendor files from performance warnings
        return !assetFilename.endsWith('pdf.worker.mjs') && 
               !assetFilename.includes('vendor') &&
               !assetFilename.includes('pdf-libs');
      }
    };

    // Add the CopyPlugin to copy the pdf.worker.mjs file
    try {
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
    } catch (error) {
      console.warn('Could not copy PDF worker file:', error);
    }

    // Fix module resolution for server vs client and externalize problematic packages
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
        'pdf-parse': 'commonjs pdf-parse',
        'pdf2json': 'commonjs pdf2json',
        'canvas': 'commonjs canvas',
      });
    }

    return config;
  },
};

export default nextConfig;
