#!/usr/bin/env node

// Quick V36 Production Test - Final Fix Test
const fs = require('fs');

async function testV36() {
  console.log('🔥 QUICK V36 TEST - PDF EXTRACTION FIX');
  console.log('============================================================');
  
  const productionUrl = 'https://shg-mangement.vercel.app/api/pdf-upload-v15';
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  // Wait for deployment
  console.log('⏳ Waiting for V36 deployment...');
  
  for (let i = 0; i < 20; i++) {
    try {
      const versionResponse = await fetch(productionUrl);
      const versionData = await versionResponse.json();
      
      console.log(`   Check ${i + 1}: Version ${versionData.version || 'Unknown'}`);
      
      if (versionData.version === 'V36') {
        console.log('✅ V36 DEPLOYED! Testing PDF...');
        
        if (!fs.existsSync(pdfPath)) {
          console.log('❌ PDF file not found');
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
        
        console.log(`📊 Upload Status: ${uploadResponse.status}`);
        
        if (uploadResponse.ok) {
          const result = await uploadResponse.json();
          console.log('🎉 SUCCESS! PDF EXTRACTION WORKING!');
          console.log(`👥 Members: ${result.memberCount}`);
          console.log(`💰 Total: ₹${result.totalLoanAmount?.toLocaleString()}`);
          console.log(`🔧 Method: ${result.extractionMethod}`);
          return;
        } else {
          const errorText = await uploadResponse.text();
          console.log('❌ Still failing:', errorText);
          return;
        }
      }
      
    } catch (e) {
      console.log(`   Check ${i + 1}: Error -`, e.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second intervals
  }
  
  console.log('⏰ Timeout waiting for V36');
}

testV36();
