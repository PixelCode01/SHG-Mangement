#!/usr/bin/env node

// Test the actual production site with members.pdf to identify the issue

const fs = require('fs');
const FormData = require('form-data');

async function testProductionSite() {
  console.log('🌐 Testing ACTUAL Production Site with members.pdf');
  console.log('=' .repeat(60));
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found at expected location');
    return;
  }
  
  console.log('📄 PDF file found, testing production deployment...');
  
  // Test production URL - you'll need to update this with actual production URL
  const productionUrls = [
    'https://your-vercel-app.vercel.app/api/pdf-upload-v15',
    // Add your actual production URL here
  ];
  
  // Test local first for comparison
  console.log('\n🏠 Testing Local (for comparison)');
  console.log('-' .repeat(40));
  
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(pdfPath));
    
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('http://localhost:3000/api/pdf-upload-v15', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log(`📊 Local Status: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Local Success: ${result.members.length} members extracted`);
      console.log(`🔧 Local Method: ${result.extractionMethod}`);
    } else {
      console.log('❌ Local Failed:', result.error);
    }
    
  } catch (error) {
    console.log(`❌ Local Request failed: ${error.message}`);
  }
  
  // Test production URLs (you'll need to add your actual production URL)
  console.log('\n🌐 Testing Production URLs');
  console.log('-' .repeat(40));
  console.log('⚠️  Note: Add your actual production URL to test');
  console.log('🔗 Common patterns:');
  console.log('   - https://your-app-name.vercel.app/api/pdf-upload-v15');
  console.log('   - https://your-domain.com/api/pdf-upload-v15');
  
  // You can manually test by visiting the production URL in a browser first
  console.log('\n🧪 Manual Testing Steps:');
  console.log('1. Open your production app in browser');
  console.log('2. Navigate to the PDF upload page');
  console.log('3. Upload members.pdf');
  console.log('4. Check browser dev tools Console and Network tabs for errors');
  console.log('5. Check Vercel function logs for detailed error messages');
  
  // Check deployment status
  console.log('\n📋 Deployment Verification:');
  console.log('1. Ensure latest code is deployed to production');
  console.log('2. Check if pdf-parse package is included in production build');
  console.log('3. Verify Node.js version compatibility in production');
  console.log('4. Check Vercel function timeout and memory limits');
  
  // Common production issues
  console.log('\n🔍 Common Production Issues:');
  console.log('1. pdf-parse not installed in production dependencies');
  console.log('2. Node.js version mismatch between local and production');
  console.log('3. Vercel function timeout (default 10s for Hobby plan)');
  console.log('4. Memory limits exceeded during PDF processing');
  console.log('5. Missing native dependencies for pdf-parse');
  
  // Diagnostic commands
  console.log('\n💻 Diagnostic Commands:');
  console.log('# Check Vercel deployment:');
  console.log('vercel --version');
  console.log('vercel ls');
  console.log('vercel logs');
  console.log('');
  console.log('# Check production build:');
  console.log('npm run build');
  console.log('npm ls pdf-parse');
}

testProductionSite().catch(console.error);
