#!/usr/bin/env node

// Proper PDF Analysis using pdf-parse library
// Get actual readable content from the members.pdf file

const fs = require('fs');

async function analyzePDFWithLibrary() {
  console.log('📚 PDF LIBRARY ANALYSIS');
  console.log('============================================================');
  
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  try {
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      console.log(`❌ PDF file not found: ${pdfPath}`);
      return;
    }
    
    // Try with pdf-parse
    console.log('🔍 Method 1: Using pdf-parse library...');
    try {
      const pdf = require('pdf-parse');
      const buffer = fs.readFileSync(pdfPath);
      const data = await pdf(buffer);
      
      console.log(`✅ PDF parsed successfully`);
      console.log(`📄 Pages: ${data.numpages}`);
      console.log(`📝 Text length: ${data.text.length}`);
      console.log(`📊 Info:`, data.info);
      
      console.log('\n📋 First 500 characters of extracted text:');
      console.log('─'.repeat(60));
      console.log(data.text.substring(0, 500));
      console.log('─'.repeat(60));
      
      // Look for name patterns in the extracted text
      console.log('\n🔍 Searching for Indian names...');
      const indianNamePatterns = [
        /([A-Z][a-z]+\s+(?:Devi|Kumari|Singh|Kumar|Prasad|Yadav|Gupta|Sharma))/g,
        /([A-Z][a-z]+\s+[A-Z][a-z]+\s+(?:Devi|Kumari|Singh|Kumar|Prasad))/g,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)/g
      ];
      
      let allFoundNames = [];
      indianNamePatterns.forEach((pattern, i) => {
        const matches = Array.from(data.text.matchAll(pattern));
        console.log(`   Pattern ${i + 1}: ${matches.length} matches`);
        matches.forEach(match => allFoundNames.push(match[1]));
      });
      
      // Remove duplicates and show found names
      const uniqueNames = [...new Set(allFoundNames)];
      console.log(`\n👥 Found ${uniqueNames.length} unique names:`);
      uniqueNames.slice(0, 20).forEach((name, i) => {
        console.log(`   ${i + 1}. ${name}`);
      });
      
      // Look for numbers that might be amounts
      console.log('\n💰 Looking for loan amounts...');
      const numbers = data.text.match(/\d+(?:,\d{3})*(?:\.\d{2})?/g);
      if (numbers) {
        const amounts = numbers
          .map(n => parseFloat(n.replace(/,/g, '')))
          .filter(n => n >= 1000 && n <= 500000) // Reasonable loan amounts
          .sort((a, b) => b - a);
        
        console.log(`   Found ${amounts.length} potential loan amounts:`);
        amounts.slice(0, 15).forEach((amount, i) => {
          console.log(`   ${i + 1}. ₹${amount.toLocaleString()}`);
        });
        
        if (amounts.length > 0) {
          console.log(`   Total of top amounts: ₹${amounts.slice(0, Math.min(50, amounts.length)).reduce((a, b) => a + b, 0).toLocaleString()}`);
        }
      }
      
      // Try to find name-amount pairs
      console.log('\n🔗 Looking for name-amount patterns...');
      const lines = data.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      let nameAmountPairs = [];
      
      for (const line of lines) {
        // Pattern: Name followed by amount
        const nameAmountPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/;
        const match = line.match(nameAmountPattern);
        if (match) {
          const name = match[1];
          const amount = parseFloat(match[2].replace(/,/g, ''));
          if (amount >= 1000 && amount <= 500000) {
            nameAmountPairs.push({ name, amount });
          }
        }
      }
      
      console.log(`   Found ${nameAmountPairs.length} name-amount pairs:`);
      nameAmountPairs.slice(0, 15).forEach((pair, i) => {
        console.log(`   ${i + 1}. ${pair.name} - ₹${pair.amount.toLocaleString()}`);
      });
      
    } catch (pdfParseError) {
      console.log(`❌ pdf-parse failed: ${pdfParseError.message}`);
    }
    
    // Try with pdf2json as backup
    console.log('\n🔍 Method 2: Using pdf2json library...');
    try {
      const PDFParser = require('pdf2json');
      
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
          
          const buffer = fs.readFileSync(pdfPath);
          pdfParser.parseBuffer(buffer);
        });
      };
      
      const pdf2jsonText = await extractWithPdf2json();
      console.log(`✅ pdf2json extraction successful`);
      console.log(`📝 Text length: ${pdf2jsonText.length}`);
      
      console.log('\n📋 First 500 characters of pdf2json text:');
      console.log('─'.repeat(60));
      console.log(pdf2jsonText.substring(0, 500));
      console.log('─'.repeat(60));
      
    } catch (pdf2jsonError) {
      console.log(`❌ pdf2json failed: ${pdf2jsonError.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Error during PDF analysis: ${error.message}`);
  }
}

analyzePDFWithLibrary();
