const fs = require('fs');

async function parseSwawlambanPDF() {
  const pdfPath = './public/swawlamban-may-2025.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF file not found');
    return;
  }
  
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    
    console.log('📄 Reading SWAWLAMBAN PDF...');
    const data = await pdfParse(dataBuffer);
    
    console.log('✅ PDF parsed successfully');
    console.log('📊 Pages:', data.numpages);
    console.log('📝 Text length:', data.text.length);
    
    // Clean the text and extract lines
    const lines = data.text.split('\n')
      .map(line => line.trim())
      .filter(line => line && line !== 'NAMELOAN' && line !== 'AI');
    
    console.log(`\n📋 Processing ${lines.length} data lines...`);
    
    const members = [];
    const failedLines = [];
    
    // Parse each line - format appears to be: NAME followed by AMOUNT (no space)
    for (const line of lines) {
      // Try to match: letters/spaces followed by digits at the end
      const match = line.match(/^(.+?)(\d+)$/);
      
      if (match) {
        const name = match[1].trim();
        const amount = parseInt(match[2]);
        
        // Skip if name is too short or amount is unrealistic
        if (name.length >= 3 && amount >= 0) {
          members.push({
            name: name,
            loanAmount: amount,
            originalLine: line
          });
        } else {
          failedLines.push(line);
        }
      } else {
        failedLines.push(line);
      }
    }
    
    console.log(`\n✅ Successfully parsed ${members.length} members`);
    console.log(`❌ Failed to parse ${failedLines.length} lines`);
    
    if (failedLines.length > 0) {
      console.log('\n❌ Failed lines:');
      failedLines.forEach((line, index) => {
        console.log(`  ${index + 1}. "${line}"`);
      });
    }
    
    // Show sample of parsed members
    console.log('\n👥 Sample of parsed members:');
    console.log('='.repeat(60));
    for (let i = 0; i < Math.min(10, members.length); i++) {
      const member = members[i];
      console.log(`${(i+1).toString().padStart(3)}. ${member.name.padEnd(25)} | ₹${member.loanAmount.toLocaleString()}`);
    }
    
    // Statistics
    console.log('\n📊 Statistics:');
    console.log('='.repeat(60));
    const totalLoanAmount = members.reduce((sum, member) => sum + member.loanAmount, 0);
    const membersWithLoans = members.filter(member => member.loanAmount > 0);
    const membersWithoutLoans = members.filter(member => member.loanAmount === 0);
    
    console.log(`Total Members: ${members.length}`);
    console.log(`Members with Loans: ${membersWithLoans.length}`);
    console.log(`Members without Loans: ${membersWithoutLoans.length}`);
    console.log(`Total Loan Amount: ₹${totalLoanAmount.toLocaleString()}`);
    
    if (membersWithLoans.length > 0) {
      const avgLoanAmount = totalLoanAmount / membersWithLoans.length;
      const maxLoan = Math.max(...membersWithLoans.map(m => m.loanAmount));
      const minLoan = Math.min(...membersWithLoans.map(m => m.loanAmount).filter(a => a > 0));
      
      console.log(`Average Loan Amount: ₹${avgLoanAmount.toLocaleString()}`);
      console.log(`Highest Loan: ₹${maxLoan.toLocaleString()}`);
      console.log(`Lowest Loan: ₹${minLoan.toLocaleString()}`);
    }
    
    // Save parsed data as JSON
    const outputData = {
      source: 'SWAWLAMBAN till may 2025.pdf',
      parsedAt: new Date().toISOString(),
      totalMembers: members.length,
      totalLoanAmount: totalLoanAmount,
      members: members
    };
    
    fs.writeFileSync('./swawlamban-parsed-data.json', JSON.stringify(outputData, null, 2));
    console.log('\n💾 Parsed data saved to swawlamban-parsed-data.json');
    
    // Save as CSV for easy import
    const csvLines = ['Name,Loan Amount'];
    members.forEach(member => {
      csvLines.push(`"${member.name}",${member.loanAmount}`);
    });
    
    fs.writeFileSync('./swawlamban-members.csv', csvLines.join('\n'));
    console.log('💾 CSV data saved to swawlamban-members.csv');
    
    return members;
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log(error.stack);
  }
}

// Run the parser
parseSwawlambanPDF().catch(console.error);
