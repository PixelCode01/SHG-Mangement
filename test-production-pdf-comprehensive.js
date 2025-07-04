#!/usr/bin/env node

// Comprehensive Production PDF Testing Script
// Tests both local and production environments for PDF extraction

const fs = require('fs');
const FormData = require('form-data');

async function testProductionPDF() {
  console.log('🌐 PRODUCTION PDF EXTRACTION TEST');
  console.log('=' .repeat(60));
  console.log(`📅 Test Date: ${new Date().toISOString()}`);
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found at expected location');
    console.log('💡 Please ensure the PDF file is available at:', pdfPath);
    return;
  }
  
  console.log('📄 PDF file found, starting comprehensive test...');
  
  // Define test endpoints
  const endpoints = [
    {
      name: 'Local Development',
      url: 'http://localhost:3000/api/pdf-upload-v15',
      type: 'local'
    }
    // Add production URLs here - user needs to provide actual production URL
  ];
  
  // Try to detect common production URL patterns
  const potentialProdUrls = [
    'https://shg-management.vercel.app/api/pdf-upload-v15',
    'https://shg-mangement.vercel.app/api/pdf-upload-v15',
    'https://your-app-name.vercel.app/api/pdf-upload-v15'
  ];
  
  console.log('\n🔍 DETECTED POTENTIAL PRODUCTION URLS:');
  potentialProdUrls.forEach((url, i) => {
    console.log(`   ${i + 1}. ${url}`);
  });
  
  console.log('\n⚠️  Please check your actual production URL and test manually if needed.');
  
  // Test available endpoints
  for (const endpoint of endpoints) {
    console.log(`\n🧪 Testing ${endpoint.name}`);
    console.log('-' .repeat(50));
    console.log(`📡 URL: ${endpoint.url}`);
    
    try {
      // Test 1: Check if API is accessible
      console.log('\n📋 Step 1: API Accessibility Test');
      const fetch = (await import('node-fetch')).default;
      
      const healthResponse = await fetch(endpoint.url, {
        method: 'GET',
        timeout: 10000
      });
      
      console.log(`   📊 Status: ${healthResponse.status} ${healthResponse.statusText}`);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log(`   ✅ API Version: ${healthData.version || 'Unknown'}`);
        console.log(`   📝 Message: ${healthData.message || 'No message'}`);
      } else {
        console.log(`   ❌ API not accessible: ${healthResponse.status}`);
        continue;
      }
      
      // Test 2: PDF Upload Test
      console.log('\n📋 Step 2: PDF Upload Test');
      
      const form = new FormData();
      form.append('file', fs.createReadStream(pdfPath));
      
      console.log('   📤 Uploading members.pdf...');
      
      const uploadResponse = await fetch(endpoint.url, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 30000 // 30 second timeout for PDF processing
      });
      
      console.log(`   📊 Upload Status: ${uploadResponse.status} ${uploadResponse.statusText}`);
      
      const result = await uploadResponse.json();
      
      if (result.success) {
        console.log('\n   ✅ PDF EXTRACTION SUCCESSFUL!');
        console.log(`   📋 Members extracted: ${result.members.length}`);
        console.log(`   🔧 Extraction method: ${result.extractionMethod}`);
        console.log(`   📏 Text length: ${result.textLength || 'Unknown'}`);
        
        if (result.summary) {
          console.log('\n   📊 Summary:');
          console.log(`      Total members: ${result.summary.totalMembers}`);
          console.log(`      Total loan amount: ₹${result.summary.totalLoanAmount.toLocaleString()}`);
          console.log(`      Average loan amount: ₹${result.summary.averageLoanAmount.toLocaleString()}`);
          console.log(`      Members with loans: ${result.summary.membersWithLoans}`);
        }
        
        console.log('\n   📋 Sample extracted members:');
        result.members.slice(0, 5).forEach((member, index) => {
          console.log(`      ${index + 1}. ${member.name} - Loan: ₹${(member.currentLoanAmount || 0).toLocaleString()}`);
        });
        
        // Verify expected results
        if (result.members.length === 51) {
          console.log('\n   🎉 PERFECT! All 51 members extracted correctly!');
        } else {
          console.log(`\n   ⚠️  Note: Expected 51 members, got ${result.members.length}`);
        }
        
      } else {
        console.log('\n   ❌ PDF EXTRACTION FAILED');
        console.log(`   🔴 Error: ${result.error}`);
        console.log(`   💬 Message: ${result.message || 'No message'}`);
        
        if (result.details) {
          console.log('\n   📋 Failure Details:');
          console.log(`      Extraction method attempted: ${result.extractionMethod || 'Unknown'}`);
          
          if (result.details.strategies) {
            console.log('      Failed strategies:');
            result.details.strategies.forEach((strategy, i) => {
              console.log(`         ${i + 1}. ${strategy.name}: ${strategy.error}`);
            });
          }
          
          if (result.details.environment) {
            console.log('      Environment info:');
            console.log(`         Node version: ${result.details.environment.nodeVersion}`);
            console.log(`         Platform: ${result.details.environment.platform}`);
            console.log(`         Buffer size: ${result.details.environment.bufferSize} bytes`);
          }
          
          if (result.details.recommendations) {
            console.log('      💡 Recommendations:');
            result.details.recommendations.forEach((rec, i) => {
              console.log(`         ${i + 1}. ${rec}`);
            });
          }
        }
      }
      
    } catch (error) {
      console.log(`\n   ❌ Test failed: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Connection refused - check if the service is running');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('   💡 Request timed out - service may be slow or overloaded');
      } else {
        console.log(`   💡 Error code: ${error.code || 'Unknown'}`);
      }
    }
  }
  
  // Production testing instructions
  console.log('\n' + '=' .repeat(60));
  console.log('🌐 PRODUCTION TESTING INSTRUCTIONS');
  console.log('=' .repeat(60));
  
  console.log('\n📋 To test your actual production site:');
  console.log('1. Find your production URL (check Vercel dashboard or deployment logs)');
  console.log('2. Visit: https://your-production-url.vercel.app/api/pdf-upload-v15');
  console.log('3. Should return: {"status":"OK","version":"V34",...}');
  console.log('4. Test PDF upload through your app\'s UI');
  console.log('5. Check browser dev tools for any errors');
  
  console.log('\n🔍 How to find your production URL:');
  console.log('• Check Vercel dashboard');
  console.log('• Look at previous deployment logs');
  console.log('• Check package.json or deployment configs');
  console.log('• Look for environment variables');
  
  console.log('\n🧪 Manual production test steps:');
  console.log('1. Open your production app in browser');
  console.log('2. Navigate to the PDF upload feature');
  console.log('3. Upload members.pdf');
  console.log('4. Check if 51 members are extracted');
  console.log('5. Verify loan amounts are correct');
  console.log('6. If it fails, check browser console and network tabs');
  
  console.log('\n📞 If production still fails:');
  console.log('• Check Vercel function logs: `vercel logs`');
  console.log('• Verify pdf-parse and pdf2json are in dependencies');
  console.log('• Check Node.js version compatibility');
  console.log('• Monitor memory usage and timeouts');
  
  console.log('\n🎯 Expected production results:');
  console.log('✅ 51 members extracted');
  console.log('✅ Total loan amount: ₹6,993,284');
  console.log('✅ Extraction method: pdf-parse-primary, pdf2json-fallback, or binary-pattern-extraction');
  console.log('✅ No JavaScript errors in browser console');
}

testProductionPDF().catch(console.error);
