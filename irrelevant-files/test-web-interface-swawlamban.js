// Test script to verify SWAWLAMBAN PDF import through web interface
console.log('Testing SWAWLAMBAN PDF import through web interface...\n');

// Test the dedicated API endpoint
async function testSwawlambanAPI() {
  const fs = require('fs');
  const path = require('path');
  
  const filePath = '/home/pixel/aichat/SHG-Mangement-main/public/swawlamban-may-2025.pdf';
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ SWAWLAMBAN PDF file not found:', filePath);
    return;
  }
  
  const FormData = require('form-data');
  const fetch = require('node-fetch');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), 'swawlamban-may-2025.pdf');
  
  try {
    console.log('📤 Uploading SWAWLAMBAN PDF to dedicated API...');
    const response = await fetch('http://localhost:3000/api/pdf-parse-swawlamban', {
      method: 'POST',
      body: form
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      return;
    }
    
    const data = await response.json();
    
    if (data.success && data.members) {
      console.log('✅ SWAWLAMBAN API Success!');
      console.log(`📊 Statistics:`);
      console.log(`   - Total members extracted: ${data.statistics.totalMembers}`);
      console.log(`   - Members with loans: ${data.statistics.membersWithLoans}`);
      console.log(`   - Members without loans: ${data.statistics.membersWithoutLoans}`);
      console.log(`   - Total loan amount: ₹${data.statistics.totalLoanAmount.toLocaleString()}`);
      
      console.log('\n📋 First 10 members:');
      data.members.slice(0, 10).forEach((member, index) => {
        console.log(`${index + 1}. ${member.name} - ₹${parseInt(member['loan amount']).toLocaleString()}`);
      });
      
      console.log('\n✅ Web interface should now be able to import all 51 members!');
    } else {
      console.error('❌ Unexpected API response:', data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSwawlambanAPI();
