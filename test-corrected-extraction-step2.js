#!/usr/bin/env node

// Test member extraction with the actual PDF content patterns found
// Create a corrected extraction logic based on the real PDF structure

const fs = require('fs');

async function testCorrectedExtraction() {
  console.log('🔧 CORRECTED MEMBER EXTRACTION TEST');
  console.log('============================================================');
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  try {
    const pdf = require('pdf-parse');
    const PDFParser = require('pdf2json');
    
    // Method 1: pdf-parse
    console.log('📚 Extracting with pdf-parse...');
    const buffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(buffer);
    console.log(`✅ Extracted ${pdfData.text.length} characters`);
    
    // Method 2: pdf2json for better spacing
    console.log('📚 Extracting with pdf2json...');
    const extractWithPdf2json = () => {
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_dataError', (errData) => {
          reject(new Error(`PDF2JSON Error: ${errData.parserError}`));
        });
        
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
          try {
            let text = '';
            if (pdfData.Pages) {
              for (const page of pdfData.Pages) {
                if (page.Texts) {
                  for (const textItem of page.Texts) {
                    if (textItem.R) {
                      for (const run of textItem.R) {
                        if (run.T) {
                          text += decodeURIComponent(run.T) + ' ';
                        }
                      }
                    }
                  }
                }
              }
            }
            resolve(text);
          } catch (parseError) {
            reject(parseError);
          }
        });
        
        pdfParser.parseBuffer(buffer);
      });
    };
    
    const pdf2jsonText = await extractWithPdf2json();
    console.log(`✅ pdf2json extracted ${pdf2jsonText.length} characters`);
    
    // Use the better spaced text
    const text = pdf2jsonText;
    console.log('\n📋 Working with text:');
    console.log(text.substring(0, 300) + '...');
    
    // Corrected extraction strategy based on actual content
    console.log('\n🔍 Applying corrected extraction strategy...');
    
    const members = [];
    
    // Pattern 1: Name followed by number (based on actual content structure)
    console.log('Strategy 1: Name-Number pattern extraction...');
    
    // The text shows patterns like "SANTOSH MISHRA 178604"
    const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s+(\d+)/g;
    
    let matches = Array.from(text.matchAll(nameNumberPattern));
    console.log(`Found ${matches.length} name-number patterns`);
    
    for (const match of matches) {
      const rawName = match[1].trim();
      const amount = parseInt(match[2]);
      
      // Skip headers and invalid entries
      if (rawName.includes('NAME') || rawName.includes('LOAN') || 
          rawName.includes('EMAIL') || rawName.includes('PHONE') ||
          rawName.length < 5) {
        continue;
      }
      
      // Convert to proper case
      const properName = rawName.toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Validate as reasonable member data
      if (properName.split(' ').length >= 2 && properName.split(' ').length <= 4) {
        members.push({
          name: properName,
          loanAmount: amount,
          currentLoanAmount: amount,
          currentShare: amount > 0 ? Math.min(5000, Math.max(1000, amount * 0.1)) : 1000
        });
        
        console.log(`✅ Added: ${properName} - Loan: ₹${amount.toLocaleString()}`);
      }
    }
    
    console.log(`\n📊 Extraction Results:`);
    console.log(`👥 Total members: ${members.length}`);
    
    const totalLoanAmount = members.reduce((sum, m) => sum + m.loanAmount, 0);
    const membersWithLoans = members.filter(m => m.loanAmount > 0).length;
    
    console.log(`💰 Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
    console.log(`📈 Members with loans: ${membersWithLoans}/${members.length}`);
    console.log(`💵 Average loan: ₹${Math.round(totalLoanAmount / members.length).toLocaleString()}`);
    
    console.log('\n📋 Member List:');
    console.log('═'.repeat(70));
    members.forEach((member, i) => {
      console.log(`${(i + 1).toString().padStart(2, '0')}. ${member.name.padEnd(25)} | ₹${member.loanAmount.toLocaleString().padStart(8)}`);
    });
    console.log('═'.repeat(70));
    
    // Test the format that the frontend expects
    console.log('\n🎯 Frontend-compatible format:');
    const frontendData = {
      success: true,
      members: members,
      memberCount: members.length,
      totalLoanAmount: totalLoanAmount,
      extractionMethod: 'corrected-name-number-pattern'
    };
    
    console.log('Response structure:');
    console.log({
      success: frontendData.success,
      memberCount: frontendData.memberCount,
      totalLoanAmount: frontendData.totalLoanAmount,
      extractionMethod: frontendData.extractionMethod,
      sampleMember: frontendData.members[0]
    });
    
    return frontendData;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testCorrectedExtraction();
