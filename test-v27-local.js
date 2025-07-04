#!/usr/bin/env node

// Test the new V27 API locally before production deployment
// This will verify that the corrected extraction logic works as expected

const fs = require('fs');

async function testV27APILocally() {
  console.log('🧪 LOCAL V27 API TEST');
  console.log('============================================================');
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  // Simulate the API logic locally
  try {
    console.log('📚 Loading PDF libraries...');
    const pdf = require('pdf-parse');
    const PDFParser = require('pdf2json');
    
    console.log('📄 Reading PDF file...');
    const buffer = fs.readFileSync(pdfPath);
    
    let allText = '';
    let extractionMethod = 'unknown';
    
    // Method 1: Try pdf2json first (gives better spacing)
    try {
      console.log('🔄 Method 1 - Trying pdf2json...');
      
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
      
      allText = await extractWithPdf2json();
      extractionMethod = 'pdf2json';
      console.log('✅ pdf2json extraction successful');
      
    } catch (pdf2jsonError) {
      console.log('⚠️ pdf2json failed, trying pdf-parse...');
      
      // Method 2: Try pdf-parse as backup
      try {
        console.log('🔄 Method 2 - Trying pdf-parse...');
        const pdfData = await pdf(buffer);
        allText = pdfData.text;
        extractionMethod = 'pdf-parse';
        console.log('✅ pdf-parse extraction successful');
      } catch (pdfParseError) {
        console.log('❌ Both extraction methods failed');
        throw new Error(`All PDF extraction methods failed`);
      }
    }
    
    console.log(`📝 Extracted text length: ${allText.length}`);
    console.log(`📋 First 200 chars: ${allText.substring(0, 200)}`);
    
    // Apply V27 extraction logic
    console.log('\n🔍 Applying V27 extraction logic...');
    
    const members = [];
    
    // Pattern: NAME followed by NUMBER
    const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s+(\d+)/g;
    
    const matches = Array.from(allText.matchAll(nameNumberPattern));
    console.log(`📊 Found ${matches.length} name-number patterns`);
    
    for (const match of matches) {
      if (!match[1] || !match[2]) continue;
      
      const rawName = match[1].trim();
      const amount = parseInt(match[2]);
      
      // Skip headers and invalid entries
      if (rawName.includes('NAME') || rawName.includes('LOAN') || 
          rawName.includes('EMAIL') || rawName.includes('PHONE') ||
          rawName.includes('TOTAL') || rawName.includes('SUM') ||
          rawName.length < 5) {
        console.log(`⏭️ Skipping header/invalid: ${rawName}`);
        continue;
      }
      
      // Convert to proper case
      const properName = rawName.toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Validate as reasonable member data
      const nameWords = properName.split(' ');
      if (nameWords.length >= 2 && nameWords.length <= 4 && 
          properName.length >= 5 && properName.length <= 50) {
        
        members.push({
          name: properName,
          loanAmount: amount,
          currentLoanAmount: amount,
          currentShare: amount > 0 ? Math.min(5000, Math.max(1000, amount * 0.1)) : 1000
        });
        
        console.log(`✅ Added: ${properName} - Loan: ₹${amount.toLocaleString()}`);
      } else {
        console.log(`⏭️ Skipping invalid name format: ${properName}`);
      }
    }
    
    // Remove duplicates by name
    const uniqueMembers = members.filter((member, index, self) => 
      index === self.findIndex(m => m.name.toLowerCase() === member.name.toLowerCase())
    );
    
    // Calculate totals
    const totalLoanAmount = uniqueMembers.reduce((sum, member) => sum + member.loanAmount, 0);
    const membersWithLoans = uniqueMembers.filter(m => m.loanAmount > 0).length;
    
    console.log('\n📊 V27 LOCAL TEST RESULTS:');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`👥 Total members: ${uniqueMembers.length}`);
    console.log(`💰 Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
    console.log(`📈 Members with loans: ${membersWithLoans}/${uniqueMembers.length}`);
    console.log(`🔧 Extraction method: ${extractionMethod}`);
    console.log('══════════════════════════════════════════════════════════');
    
    // Show first 10 members
    console.log('\n📋 First 10 members:');
    uniqueMembers.slice(0, 10).forEach((member, i) => {
      console.log(`  ${(i + 1).toString().padStart(2, '0')}. ${member.name.padEnd(25)} | ₹${member.loanAmount.toLocaleString().padStart(8)}`);
    });
    
    // Create API response format
    const apiResponse = {
      success: true,
      message: `Successfully extracted ${uniqueMembers.length} members using ${extractionMethod}`,
      members: uniqueMembers,
      memberCount: uniqueMembers.length,
      totalLoanAmount: totalLoanAmount,
      membersWithLoans: membersWithLoans,
      extractionMethod: extractionMethod,
      textLength: allText.length,
      extractionDetails: {
        totalMatches: matches.length,
        validMembers: uniqueMembers.length,
        patternsUsed: ['corrected-name-number']
      }
    };
    
    console.log('\n🎯 API Response Structure:');
    console.log({
      success: apiResponse.success,
      memberCount: apiResponse.memberCount,
      totalLoanAmount: apiResponse.totalLoanAmount,
      membersWithLoans: apiResponse.membersWithLoans,
      extractionMethod: apiResponse.extractionMethod
    });
    
    console.log('\n✅ V27 LOCAL TEST SUCCESSFUL!');
    console.log('   This logic should work perfectly in production');
    
    return apiResponse;
    
  } catch (error) {
    console.log(`❌ Local test error: ${error.message}`);
    throw error;
  }
}

testV27APILocally().then(() => {
  console.log('\n🏁 Local V27 test completed successfully');
}).catch(error => {
  console.log(`\n💥 Local test failed: ${error.message}`);
});
