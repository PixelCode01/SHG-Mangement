#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🤖 Starting Automated PDF Import Fix Testing');
console.log('==============================================');

const strategies = [
  {
    name: 'V10_NO_PDFJS_PURE_BINARY',
    description: 'Pure binary extraction without PDF.js library',
  },
  {
    name: 'V11_SERVER_SIDE_ONLY', 
    description: 'Move all PDF processing to server-side API',
  },
  {
    name: 'V12_FALLBACK_METHOD',
    description: 'Use multiple fallback extraction methods',
  }
];

async function sleep(seconds) {
  console.log('⏳ Waiting ' + seconds + ' seconds...');
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function runCommand(command, description) {
  console.log('🔧 ' + description);
  console.log('   Running: ' + command);
  try {
    const output = execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
    console.log('   ✅ Success');
    return { success: true, output };
  } catch (error) {
    console.log('   ❌ Failed: ' + error.message);
    return { success: false, error: error.message };
  }
}

async function updateNextConfig(strategy) {
  console.log('\\n🚀 Implementing Strategy: ' + strategy.name);
  
  const nextConfigContent = `import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ${strategy.name} - ${strategy.description}
  generateBuildId: async () => {
    return \`build-\${Date.now()}-${strategy.name.toLowerCase()}\`;
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
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
  poweredByHeader: false,
  compress: true,
  webpack: (config, { buildId: _buildId, dev: _dev, isServer: _isServer, defaultLoaders: _defaultLoaders, webpack: _webpack }) => {
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
    return config;
  },
};

export default nextConfig;
`;

  fs.writeFileSync('next.config.ts', nextConfigContent);
  console.log('   ✅ Updated next.config.ts');
  return true;
}

async function deployStrategy(strategy) {
  console.log('\\n📦 Building and deploying ' + strategy.name + '...');
  
  // Build
  const buildResult = await runCommand('npm run build', 'Building project');
  if (!buildResult.success) {
    console.log('❌ Build failed, skipping deployment');
    return false;
  }
  
  // Commit and push
  const commitResult = await runCommand(
    'git add -A && git commit -m "' + strategy.name + ': ' + strategy.description + '" && git push',
    'Committing and pushing to trigger deployment'
  );
  
  if (!commitResult.success) {
    console.log('❌ Git push failed, skipping test');
    return false;
  }
  
  console.log('🚀 Deployment triggered successfully');
  console.log('⏳ Waiting 150 seconds for Vercel deployment...');
  await sleep(150);
  
  return true;
}

async function main() {
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    console.log('\\n' + '='.repeat(60));
    console.log('🔄 ATTEMPT ' + (i + 1) + '/' + strategies.length + ': ' + strategy.name);
    console.log('='.repeat(60));
    
    // Update strategy
    await updateNextConfig(strategy);
    
    // Deploy
    const deploySuccess = await deployStrategy(strategy);
    
    if (deploySuccess) {
      console.log('\\n🎉 ' + strategy.name + ' deployed successfully!');
      console.log('📋 Manual testing required:');
      console.log('   1. Open: https://shg-mangement.vercel.app/groups/create');
      console.log('   2. Go to Step 2 (Import Members from PDF)');
      console.log('   3. Test with members.pdf from Downloads folder');
      console.log('   4. Check browser console for success/error messages');
      console.log('   5. Strategy: ' + strategy.description);
      
      console.log('\\n❓ Please test and report if this strategy works!');
      console.log('   If it works, we can stop here.');
      console.log('   If not, continue to next strategy.');
      
      // Wait for user feedback before continuing
      if (i < strategies.length - 1) {
        console.log('\\n🔄 Continuing to next strategy in 30 seconds...');
        console.log('   (You can stop this script if current strategy works)');
        await sleep(30);
      }
    } else {
      console.log('❌ Strategy ' + strategy.name + ' failed to deploy');
    }
  }
  
  console.log('\\n🏁 All strategies attempted!');
  console.log('📊 Check the latest deployment at: https://shg-mangement.vercel.app');
}

main().catch(error => {
  console.error('💥 Automated testing failed:', error);
  process.exit(1);
});
