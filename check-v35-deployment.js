#!/usr/bin/env node

// Quick V35 Deployment Checker
// Tests if V35 is deployed to production and PDF extraction is working

const fs = require('fs');

async function checkV35Deployment() {
  console.log('🔍 CHECKING V35 DEPLOYMENT STATUS');
  console.log('============================================================');
  console.log(`📅 Check Time: ${new Date().toISOString()}`);
  
  const productionUrl = 'https://shg-mangement.vercel.app/api/pdf-upload-v15';
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  try {
    console.log('\n🌐 Step 1: Checking API Version...');
    const versionResponse = await fetch(productionUrl);
    const versionData = await versionResponse.json();
    
    console.log(`   📊 API Status: ${versionResponse.status}`);
    console.log(`   🏷️  Version: ${versionData.version || 'Unknown'}`);
    
    if (versionData.version === 'V35') {
      console.log('   ✅ V35 DEPLOYED SUCCESSFULLY!');
    } else {
      console.log('   ⏳ Still deploying... (or deployment failed)');
      console.log('   📝 Current version:', versionData.version);
      return;
    }
    
    console.log('\n📄 Step 2: Testing PDF Upload...');
    
    if (!fs.existsSync(pdfPath)) {
      console.log(`   ❌ PDF file not found: ${pdfPath}`);
      return;
    }
    
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'members.pdf');
    
    const uploadResponse = await fetch(productionUrl, {
      method: 'POST',
      body: formData
    });
    
    console.log(`   📊 Upload Status: ${uploadResponse.status}`);
    
    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      console.log('   ✅ PDF EXTRACTION SUCCESSFUL!');
      console.log(`   👥 Members extracted: ${result.memberCount || 0}`);
      console.log(`   💰 Total loan amount: ₹${result.totalLoanAmount?.toLocaleString() || '0'}`);
      console.log(`   🔧 Extraction method: ${result.extractionMethod || 'Unknown'}`);
      
      if (result.memberCount >= 50) {
        console.log('\n🎉 SUCCESS! V35 IS WORKING IN PRODUCTION! 🎉');
        console.log('✅ PDF extraction is now robust and production-ready');
      } else {
        console.log('\n⚠️  Partial success - fewer members than expected');
      }
    } else {
      const errorText = await uploadResponse.text();
      console.log('   ❌ PDF extraction still failing');
      console.log('   📝 Error:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.failedStrategies) {
          console.log('   🔧 Failed strategies:');
          errorData.failedStrategies.forEach((strategy, i) => {
            console.log(`      ${i + 1}. ${strategy}`);
          });
        }
      } catch (e) {
        // Error text wasn't JSON
      }
    }
    
  } catch (error) {
    console.log('❌ Error checking deployment:', error.message);
  }
}

// Auto-retry every 30 seconds for 5 minutes to wait for deployment
async function waitForV35() {
  const maxRetries = 10;
  let retries = 0;
  
  while (retries < maxRetries) {
    await checkV35Deployment();
    
    try {
      const versionResponse = await fetch('https://shg-mangement.vercel.app/api/pdf-upload-v15');
      const versionData = await versionResponse.json();
      
      if (versionData.version === 'V35') {
        // V35 is deployed, now test PDF
        console.log('\n🎯 V35 detected, running final PDF test...');
        await checkV35Deployment();
        break;
      }
    } catch (e) {
      // Continue waiting
    }
    
    retries++;
    if (retries < maxRetries) {
      console.log(`\n⏳ Waiting for V35 deployment... (${retries}/${maxRetries})`);
      console.log('   Checking again in 30 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  
  if (retries >= maxRetries) {
    console.log('\n⏰ Timeout waiting for V35 deployment');
    console.log('💡 You can run this script again later or check manually');
  }
}

waitForV35();
