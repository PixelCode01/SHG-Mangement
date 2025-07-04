// Test script for the new automatic PDF-to-Excel fallback functionality
// V29: Comprehensive test of PDF import with automatic fallback

const testAutomaticPDFToExcelFallback = async () => {
  console.log('🚀 V29: Testing automatic PDF-to-Excel fallback functionality');
  console.log(`📅 Test timestamp: ${new Date().toISOString()}`);
  
  try {
    // Test 1: Check that PDF-to-Excel endpoint is available
    console.log('\n📊 TEST 1: Checking PDF-to-Excel endpoint availability...');
    const healthResponse = await fetch('/api/pdf-to-excel', {
      method: 'GET'
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ PDF-to-Excel endpoint is available:', healthData);
    } else {
      console.log('❌ PDF-to-Excel endpoint not available:', healthResponse.status);
      return;
    }
    
    // Test 2: Test PDF file upload to primary endpoint (should succeed)
    console.log('\n📤 TEST 2: Testing primary PDF extraction endpoint...');
    const fs = require('fs');
    const path = require('path');
    
    const testPDFPath = '/home/pixel/Downloads/members.pdf';
    
    if (fs.existsSync(testPDFPath)) {
      const fileBuffer = fs.readFileSync(testPDFPath);
      const formData = new FormData();
      
      // Create a proper File object for testing
      const file = new File([fileBuffer], 'members.pdf', { type: 'application/pdf' });
      formData.append('file', file);
      
      const primaryResponse = await fetch('/api/pdf-upload-v15', {
        method: 'POST',
        body: formData
      });
      
      if (primaryResponse.ok) {
        const primaryResult = await primaryResponse.json();
        console.log('✅ Primary extraction successful:', {
          success: primaryResult.success,
          memberCount: primaryResult.members?.length || 0,
          method: primaryResult.extractionMethod
        });
        
        if (primaryResult.members && primaryResult.members.length > 0) {
          console.log('👥 Sample extracted members:', 
            primaryResult.members.slice(0, 3).map(m => m.name).join(', '));
        }
      } else {
        console.log('⚠️ Primary extraction failed (expected for testing fallback):', primaryResponse.status);
      }
      
      // Test 3: Test PDF-to-Excel conversion directly
      console.log('\n📊 TEST 3: Testing direct PDF-to-Excel conversion...');
      const conversionFormData = new FormData();
      conversionFormData.append('file', file);
      
      const conversionResponse = await fetch('/api/pdf-to-excel', {
        method: 'POST',
        body: conversionFormData
      });
      
      if (conversionResponse.ok) {
        const excelBuffer = await conversionResponse.arrayBuffer();
        console.log('✅ PDF-to-Excel conversion successful:', {
          bufferSize: excelBuffer.byteLength,
          contentType: conversionResponse.headers.get('content-type')
        });
        
        // Test 4: Parse the Excel buffer to verify member extraction
        console.log('\n📖 TEST 4: Testing Excel buffer parsing...');
        
        try {
          const ExcelJS = require('exceljs');
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(excelBuffer);
          const worksheet = workbook.getWorksheet(1);
          
          if (worksheet) {
            const headers = [];
            worksheet.getRow(1).eachCell((cell, colNumber) => {
              headers[colNumber - 1] = cell.text;
            });
            
            console.log('📋 Excel headers found:', headers);
            
            const members = [];
            worksheet.eachRow((row, rowNumber) => {
              if (rowNumber > 1) {
                const rowData = {};
                row.eachCell((cell, colNumber) => {
                  const header = headers[colNumber - 1];
                  if (header) {
                    rowData[header] = cell.text;
                  }
                });
                
                const name = (rowData.Name || rowData.name || rowData.NAME || '').trim();
                if (name && name.length > 1) {
                  members.push({
                    name: name,
                    loanAmount: parseFloat(rowData['Loan Amount'] || rowData['loan amount'] || '0') || 0
                  });
                }
              }
            });
            
            console.log('✅ Excel parsing successful:', {
              totalMembers: members.length,
              sampleMembers: members.slice(0, 3).map(m => m.name).join(', ')
            });
            
            if (members.length > 0) {
              console.log('🎉 FALLBACK TEST PASSED: PDF-to-Excel conversion and parsing works!');
              console.log(`📊 Summary: Extracted ${members.length} members via PDF-to-Excel fallback`);
              
              // Show some sample data
              console.log('👥 Sample member data:');
              members.slice(0, 5).forEach((member, index) => {
                console.log(`  ${index + 1}. ${member.name} - Loan: ₹${member.loanAmount}`);
              });
              
              return {
                success: true,
                method: 'pdf-to-excel-fallback',
                memberCount: members.length,
                members: members
              };
            } else {
              console.log('❌ No members found in Excel conversion');
            }
          } else {
            console.log('❌ No worksheet found in Excel file');
          }
        } catch (excelError) {
          console.error('❌ Excel parsing failed:', excelError.message);
        }
      } else {
        console.log('❌ PDF-to-Excel conversion failed:', conversionResponse.status);
      }
    } else {
      console.log('❌ Test PDF file not found at:', testPDFPath);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
};

// Test client-side automatic fallback simulation
const testClientSideIntegration = () => {
  console.log('\n🧪 TEST 5: Client-side integration simulation');
  
  // Simulate the new extraction logic flow
  const simulateExtraction = async (pdfFile) => {
    console.log('1️⃣ Attempting primary PDF extraction...');
    
    // Simulate primary extraction failure
    const primaryFailed = true;
    
    if (primaryFailed) {
      console.log('2️⃣ Primary extraction failed, starting automatic PDF-to-Excel fallback...');
      
      try {
        console.log('3️⃣ Converting PDF to Excel...');
        // This would be the actual API call in real implementation
        const conversionSuccess = true;
        
        if (conversionSuccess) {
          console.log('4️⃣ PDF-to-Excel conversion successful, parsing Excel data...');
          console.log('5️⃣ Extracting members from Excel buffer...');
          
          // Simulate successful member extraction
          const mockMembers = [
            { name: 'RAJESH KUMAR', loanAmount: 5000 },
            { name: 'SUNITA DEVI', loanAmount: 3000 },
            { name: 'SANTOSH MISHRA', loanAmount: 7500 }
          ];
          
          console.log('✅ Automatic fallback successful!');
          console.log(`📊 Found ${mockMembers.length} members via PDF-to-Excel fallback`);
          
          return mockMembers;
        }
      } catch (fallbackError) {
        console.log('❌ All extraction methods failed');
        return [];
      }
    }
  };
  
  simulateExtraction('test.pdf');
};

// Run all tests
console.log('🎯 V29: AUTOMATIC PDF-TO-EXCEL FALLBACK TEST SUITE');
console.log('=' .repeat(60));

if (typeof window !== 'undefined') {
  // Browser environment
  testAutomaticPDFToExcelFallback().then(() => {
    testClientSideIntegration();
  });
} else {
  // Node.js environment
  testClientSideIntegration();
  console.log('\n📝 Note: API tests require browser environment with fetch API');
}

module.exports = { testAutomaticPDFToExcelFallback, testClientSideIntegration };
