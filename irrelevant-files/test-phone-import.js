const ExcelJS = require('exceljs');

async function testPhoneNumberImport() {
  try {
    console.log('🧪 Testing phone number import from Excel...');
    
    const filePath = '/home/pixel/Downloads/loan_data_no_dashes.xlsx';
    
    // Load the workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    
    // Simulate the exact parsing logic from MultiStepGroupForm
    const headers = [];
    // Get headers from first row
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.text;
    });
    
    console.log('📋 Headers found:', headers);
    
    const jsonData = [];
    
    // Process data rows (simulating the Excel parsing logic)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            rowData[header] = cell.text;
          }
        });
        if (rowData.Name || rowData.name) { // Only add rows with names
          jsonData.push(rowData);
        }
      }
    });
    
    console.log('\n📊 Parsed data:');
    jsonData.forEach((row, index) => {
      console.log(`\nRow ${index + 1}:`);
      console.log(`  Name: "${row.Name || row.name || ''}"`);
      console.log(`  Loan Amount: "${row['Loan Amount'] || row['loan amount'] || ''}"`);
      console.log(`  Email: "${row.Email || row.email || ''}"`);
      console.log(`  Phone: "${row.Phone || row.phone || ''}"`);
      console.log(`  Phone Number: "${row['Phone Number'] || row['phone number'] || ''}"`);
    });
    
    // Test the updated parsing logic
    console.log('\n🔧 Testing updated parsing logic...');
    
    const validMembers = [];
    const invalidRows = [];
    
    jsonData.forEach((row, index) => {
      const name = (row['Name'] || row['name'] || '').trim();
      const loanAmountStrRaw = row['Loan Amount'] || row['loan amount'] || '';
      const loanAmountStr = loanAmountStrRaw.replace(/,/g, '').trim();
      const email = (row['Email'] || row['email'] || '').trim();
      // Updated phone parsing logic
      const phone = (row['Phone'] || row['phone'] || row['Phone Number'] || row['phone number'] || '').trim();

      if (!name.trim()) {
        invalidRows.push(`Row ${index + 1}: Missing name`);
        return;
      }

      // Treat missing loan amount as zero
      let loanAmount;
      if (loanAmountStr) {
        const parsed = parseFloat(loanAmountStr);
        if (isNaN(parsed) || parsed < 0) {
          invalidRows.push(`Row ${index + 1}: Invalid loan amount`);
          return;
        }
        loanAmount = parsed;
      } else {
        loanAmount = 0;
      }

      validMembers.push({
        name: name.trim(),
        loanAmount,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
    });
    
    console.log('\n✅ Final parsed members:');
    validMembers.forEach((member, index) => {
      console.log(`\nMember ${index + 1}:`);
      console.log(`  Name: "${member.name}"`);
      console.log(`  Loan Amount: ₹${member.loanAmount.toLocaleString()}`);
      console.log(`  Email: "${member.email || 'Not provided'}"`);
      console.log(`  Phone: "${member.phone || 'Not provided'}"`);
    });
    
    // Check if phone numbers are being imported
    const membersWithPhones = validMembers.filter(m => m.phone && m.phone.length > 0);
    console.log(`\n📱 Phone number import results:`);
    console.log(`  - Total members: ${validMembers.length}`);
    console.log(`  - Members with phone numbers: ${membersWithPhones.length}`);
    console.log(`  - Phone import success rate: ${(membersWithPhones.length / validMembers.length * 100).toFixed(1)}%`);
    
    if (membersWithPhones.length === validMembers.length) {
      console.log('\n🎉 SUCCESS: All phone numbers are being imported correctly!');
    } else if (membersWithPhones.length > 0) {
      console.log('\n⚠️  PARTIAL: Some phone numbers are being imported');
    } else {
      console.log('\n❌ ISSUE: No phone numbers are being imported');
    }
    
  } catch (error) {
    console.log('❌ Error testing phone number import:', error.message);
  }
}

// Run the test
testPhoneNumberImport();
