const fs = require('fs');

async function testEnhancedPDFParsing() {
  try {
    console.log('🧪 Testing Enhanced PDF Parsing...');
    
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    
    // Test with the user's PDF
    const pdfPath = '/home/pixel/Downloads/Swawlamban_Loan_Info.pdf';
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ PDF file not found');
      return;
    }
    
    // Create form data
    const form = new FormData();
    const fileBuffer = fs.readFileSync(pdfPath);
    form.append('file', fileBuffer, 'Swawlamban_Loan_Info.pdf');
    
    console.log('📤 Sending PDF to universal parser API...');
    
    // Make request to the enhanced universal parser
    const response = await fetch('http://localhost:3000/api/pdf-parse-universal', {
      method: 'POST',
      body: form
    });
    
    console.log(`📬 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ API Response received');
    console.log('📊 Success:', result.success);
    
    if (result.success && result.members) {
      console.log('📋 Parsed Members:');
      console.log(`   - Total: ${result.members.length}`);
      
      // Show first 10 members
      result.members.slice(0, 10).forEach((member, i) => {
        const loanAmount = parseInt(member['loan amount'] || '0');
        console.log(`   ${i + 1}. ${member.name} - ₹${loanAmount.toLocaleString()}`);
      });
      
      if (result.statistics) {
        console.log('📊 Statistics:');
        console.log(`   - Total members: ${result.statistics.totalMembers}`);
        console.log(`   - Members with loans: ${result.statistics.membersWithLoans}`);
        console.log(`   - Members without loans: ${result.statistics.membersWithoutLoans}`);
        console.log(`   - Total loan amount: ₹${result.statistics.totalLoanAmount.toLocaleString()}`);
      }
      
      console.log('📋 Format type:', result.formatType || 'pattern-detected');
      console.log('📋 Headers found:', result.headerFound || false);
      
    } else {
      console.log('❌ Parsing failed:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Test with a local development server
testEnhancedPDFParsing();
