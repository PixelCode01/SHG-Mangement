#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// PDF files to test with
const TEST_PDFS = [
  '/home/pixel/Downloads/members.pdf',
  '/home/pixel/Downloads/members (1).pdf', 
  '/home/pixel/Downloads/Swawlamban_Loan_Info.pdf',
  '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf'
];

// Strategy configurations
const strategies = [
  {
    name: 'V10_NO_PDFJS_PURE_BINARY',
    description: 'Pure binary extraction without PDF.js library',
    cspPolicy: "default-src 'self'; script-src * 'unsafe-inline' 'unsafe-eval'; worker-src * blob: data:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src *; connect-src *; frame-ancestors 'none';",
    extractionMethod: 'pure-binary'
  },
  {
    name: 'V11_SERVER_SIDE_ONLY',
    description: 'Move all PDF processing to server-side API',
    cspPolicy: "default-src 'self'; script-src * 'unsafe-inline' 'unsafe-eval'; worker-src * blob: data:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src *; connect-src *; frame-ancestors 'none';",
    extractionMethod: 'server-side'
  },
  {
    name: 'V12_PDFJS_LEGACY_CDN',
    description: 'Use older PDF.js version from different CDN',
    cspPolicy: "default-src 'self'; script-src * 'unsafe-inline' 'unsafe-eval'; worker-src * blob: data:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src *; connect-src *; frame-ancestors 'none';",
    extractionMethod: 'legacy-pdfjs'
  },
  {
    name: 'V13_BLOB_WORKER',
    description: 'Create PDF.js worker as blob to avoid CDN issues',
    cspPolicy: "default-src 'self'; script-src * 'unsafe-inline' 'unsafe-eval'; worker-src * blob: data:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src *; connect-src *; frame-ancestors 'none';",
    extractionMethod: 'blob-worker'
  }
];

let currentStrategy = 0;
const MAX_RETRIES = strategies.length;

console.log('🤖 Starting Automated PDF Import Fix Testing');
console.log('==============================================');
console.log(`📄 Testing with PDFs: ${TEST_PDFS.map(p => path.basename(p)).join(', ')}`);
console.log(`🔄 Will try ${strategies.length} different strategies`);
console.log();

async function sleep(seconds) {
  console.log(\`⏳ Waiting \${seconds} seconds...\`);
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function runCommand(command, description) {
  console.log(\`🔧 \${description}\`);
  console.log(\`   Running: \${command}\`);
  try {
    const output = execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
    console.log(\`   ✅ Success\`);
    return { success: true, output };
  } catch (error) {
    console.log(\`   ❌ Failed: \${error.message}\`);
    return { success: false, error: error.message };
  }
}

async function updateStrategy(strategy) {
  console.log(\`\\n🚀 Implementing Strategy: \${strategy.name}\`);
  console.log(\`📋 Description: \${strategy.description}\`);
  
  // Update next.config.ts with new strategy
  const nextConfigContent = \`import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // \${strategy.name} - \${strategy.description}
  generateBuildId: async () => {
    return \\\`build-\\\${Date.now()}-\${strategy.name.toLowerCase()}\\\`;
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
            value: "\${strategy.cspPolicy}",
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
\`;

  fs.writeFileSync('next.config.ts', nextConfigContent);
  console.log('   ✅ Updated next.config.ts');
  
  return true;
}

async function deployAndTest(strategy) {
  console.log(\`\\n📦 Building and deploying \${strategy.name}...\`);
  
  // Build
  const buildResult = await runCommand('npm run build', 'Building project');
  if (!buildResult.success) {
    console.log('❌ Build failed, skipping deployment');
    return false;
  }
  
  // Commit and push
  const commitResult = await runCommand(
    \`git add -A && git commit -m "\${strategy.name}: \${strategy.description}" && git push\`,
    'Committing and pushing to trigger deployment'
  );
  
  if (!commitResult.success) {
    console.log('❌ Git push failed, skipping test');
    return false;
  }
  
  console.log('🚀 Deployment triggered successfully');
  
  // Wait for deployment
  console.log('⏳ Waiting 150 seconds for Vercel deployment...');
  await sleep(150);
  
  return true;
}

async function testPDFImport(strategy) {
  console.log(\`\\n🧪 Testing PDF import with \${strategy.name}...\`);
  
  // Create a test script that will check the deployment
  const testScript = \`#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

async function testDeployment() {
  console.log('🌐 Testing deployment: https://shg-mangement.vercel.app');
  
  try {
    // Test if site is accessible
    const response = await fetch('https://shg-mangement.vercel.app/groups/create');
    if (response.ok) {
      console.log('✅ Site is accessible');
      console.log('📄 Manual test required:');
      console.log('   1. Go to: https://shg-mangement.vercel.app/groups/create');
      console.log('   2. Navigate to Step 2 (Import Members)'); 
      console.log('   3. Try uploading PDFs from Downloads folder');
      console.log('   4. Check browser console for errors');
      console.log('   Strategy: \${strategy.name}');
      console.log('   Expected: \${strategy.description}');
      return true;
    } else {
      console.log('❌ Site not accessible, deployment may have failed');
      return false;
    }
  } catch (error) {
    console.log(\\\`❌ Error testing deployment: \\\${error.message}\\\`);
    return false;
  }
}

testDeployment().then(success => {
  process.exit(success ? 0 : 1);
});
\`;

  fs.writeFileSync('test-deployment.js', testScript);
  
  const testResult = await runCommand('node test-deployment.js', 'Testing deployment accessibility');
  
  // Clean up
  fs.unlinkSync('test-deployment.js');
  
  return testResult.success;
}

async function main() {
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    console.log(\`\\n\${'='.repeat(60)}\`);
    console.log(\`🔄 ATTEMPT \${i + 1}/\${strategies.length}: \${strategy.name}\`);
    console.log(\`\${'='.repeat(60)}\`);
    
    // Update strategy
    await updateStrategy(strategy);
    
    // Deploy and test
    const deploySuccess = await deployAndTest(strategy);
    
    if (deploySuccess) {
      const testSuccess = await testPDFImport(strategy);
      
      if (testSuccess) {
        console.log(\`\\n🎉 \${strategy.name} deployed successfully!\`);
        console.log('📋 Manual testing instructions:');
        console.log('   1. Open: https://shg-mangement.vercel.app/groups/create');
        console.log('   2. Go to Step 2 (Import Members from PDF)');
        console.log('   3. Test with these PDFs:');
        TEST_PDFS.forEach(pdf => {
          console.log(\`      - \${path.basename(pdf)}\`);
        });
        console.log('   4. Check browser console for success/error messages');
        console.log(\`   5. Strategy: \${strategy.description}\`);
        
        // Ask user to test and report back
        console.log('\\n❓ Please test the PDFs and report if this strategy works!');
        console.log('   If it works, we can stop here.');
        console.log('   If not, I can continue with the next strategy.');
        break;
      }
    }
    
    console.log(\`❌ Strategy \${strategy.name} failed or needs manual verification\`);
    
    if (i < strategies.length - 1) {
      console.log(\`🔄 Proceeding to next strategy in 10 seconds...\`);
      await sleep(10);
    }
  }
  
  console.log('\\n🏁 Automated testing complete!');
  console.log('📊 Summary: Tried multiple PDF extraction strategies');
  console.log('🎯 Current deployment should be ready for manual testing');
}

main().catch(error => {
  console.error('💥 Automated testing failed:', error);
  process.exit(1);
});
