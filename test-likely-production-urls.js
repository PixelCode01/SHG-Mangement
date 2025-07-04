#!/usr/bin/env node

// Direct Production URL Tester
// Tests the most likely production URLs based on the GitHub repository name

const FormData = require('form-data');
const fs = require('fs');

async function testLikelyProductionURLs() {
  console.log('🌐 TESTING LIKELY PRODUCTION URLS');
  console.log('=' .repeat(60));
  
  // Based on GitHub repo: PixelCode01/SHG-Mangement
  const likelyURLs = [
    'https://shg-mangement.vercel.app',
    'https://shg-management.vercel.app', 
    'https://pixelcode01-shg-mangement.vercel.app',
    'https://shg-mangement-pixelcode01.vercel.app',
    'https://shg-mangement-git-main-pixelcode01.vercel.app'
  ];
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found at expected location');
    return;
  }
  
  for (const baseUrl of likelyURLs) {
    const apiUrl = `${baseUrl}/api/pdf-upload-v15`;
    
    console.log(`\n🧪 Testing: ${baseUrl}`);
    console.log('-' .repeat(50));
    
    try {
      const fetch = (await import('node-fetch')).default;
      
      // Test 1: Check if the site exists
      console.log('📋 Step 1: Site accessibility check...');
      
      const siteResponse = await fetch(baseUrl, {
        method: 'HEAD',
        timeout: 10000
      });
      
      console.log(`   📊 Site Status: ${siteResponse.status} ${siteResponse.statusText}`);
      
      if (siteResponse.status === 404) {
        console.log('   ❌ Site not found - skipping API test');
        continue;
      }
      
      // Test 2: Check API endpoint
      console.log('📋 Step 2: API endpoint check...');
      
      const apiResponse = await fetch(apiUrl, {
        method: 'GET',
        timeout: 10000
      });
      
      console.log(`   📊 API Status: ${apiResponse.status} ${apiResponse.statusText}`);
      
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        console.log(`   ✅ API Version: ${apiData.version || 'Unknown'}`);
        
        if (apiData.version === 'V34') {
          console.log('   🎉 FOUND V34 PRODUCTION API!');
          
          // Test 3: PDF Upload
          console.log('📋 Step 3: PDF upload test...');
          
          const form = new FormData();
          form.append('file', fs.createReadStream(pdfPath));
          
          const uploadResponse = await fetch(apiUrl, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
            timeout: 30000
          });
          
          console.log(`   📊 Upload Status: ${uploadResponse.status} ${uploadResponse.statusText}`);
          
          const result = await uploadResponse.json();
          
          if (result.success) {
            console.log('\n   ✅ 🎉 PRODUCTION PDF EXTRACTION WORKING! 🎉');
            console.log(`   📋 Members extracted: ${result.members.length}`);
            console.log(`   🔧 Method: ${result.extractionMethod}`);
            console.log(`   💰 Total loan amount: ₹${result.summary?.totalLoanAmount?.toLocaleString() || 'Unknown'}`);
            
            if (result.members.length === 51) {
              console.log('\n   🏆 PERFECT! All 51 members extracted correctly!');
              console.log(`\n   🎯 PRODUCTION URL CONFIRMED: ${baseUrl}`);
              console.log(`   🔗 API Endpoint: ${apiUrl}`);
              
              console.log('\n   📋 Sample extracted data:');
              result.members.slice(0, 3).forEach((member, i) => {
                console.log(`      ${i + 1}. ${member.name} - Loan: ₹${(member.currentLoanAmount || 0).toLocaleString()}`);
              });
              
              return; // Found working production site
            } else {
              console.log(`\n   ⚠️  Got ${result.members.length} members (expected 51)`);
            }
          } else {
            console.log('\n   ❌ PDF extraction failed in production');
            console.log(`   🔴 Error: ${result.error}`);
            console.log(`   💬 Message: ${result.message}`);
            
            if (result.details?.strategies) {
              console.log('   📋 Failed strategies:');
              result.details.strategies.forEach((strategy, i) => {
                console.log(`      ${i + 1}. ${strategy.name}: ${strategy.error}`);
              });
            }
          }
        } else {
          console.log('   ⚠️  Found API but not V34 version');
        }
      } else {
        console.log('   ❌ API endpoint not accessible');
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      
      if (error.code === 'ENOTFOUND') {
        console.log('   💡 Domain not found');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('   💡 Request timed out');
      }
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🔍 MANUAL VERIFICATION STEPS');
  console.log('=' .repeat(60));
  
  console.log('\nIf none of the URLs worked, try these steps:');
  console.log('1. Check your Vercel dashboard at https://vercel.com/dashboard');
  console.log('2. Look for your deployed projects');
  console.log('3. Find the SHG Management project');
  console.log('4. Copy the production URL from there');
  console.log('5. Test: https://your-actual-url.vercel.app/api/pdf-upload-v15');
  
  console.log('\n🧪 Quick manual test:');
  console.log('1. Open your production app in browser');
  console.log('2. Go to the PDF upload page');
  console.log('3. Upload members.pdf');
  console.log('4. Check if 51 members are extracted');
  console.log('5. Open browser dev tools to check for errors');
  
  console.log('\n📱 What to look for:');
  console.log('✅ 51 members extracted');
  console.log('✅ Total loan amount: ₹6,993,284');
  console.log('✅ No JavaScript errors in console');
  console.log('✅ API response shows V34 version');
}

testLikelyProductionURLs().catch(console.error);
