const fs = require('fs');

async function testV28FinalFix() {
    try {
        console.log('=== TESTING V28 FINAL FIX FOR BOTH PDF EXTRACTION METHODS ===\n');
        
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        const dataBuffer = fs.readFileSync(pdfPath);
        
        // Test with both methods
        const extractionMethods = [];
        
        // Method 1: pdf-parse
        try {
            const pdf = require('pdf-parse');
            const pdfData = await pdf(dataBuffer);
            extractionMethods.push({ name: 'pdf-parse', text: pdfData.text });
        } catch (error) {
            console.log('❌ pdf-parse failed:', error.message);
        }
        
        // Method 2: pdf2json
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
                    
                    pdfParser.parseBuffer(dataBuffer);
                });
            };
            
            const pdf2jsonText = await extractWithPdf2json();
            extractionMethods.push({ name: 'pdf2json', text: pdf2jsonText });
        } catch (error) {
            console.log('❌ pdf2json failed:', error.message);
        }
        
        // Test V28 final fix with both methods
        for (const method of extractionMethods) {
            console.log(`\n🧪 Testing V28 final fix with ${method.name}:`);
            
            // V28 Final cleaning logic
            const cleanedText = method.text
                .replace(/NAMELOANEMAILPHONE/g, '')  // Remove concatenated header (pdf-parse)
                .replace(/NAME\s+LOAN\s+EMAIL\s+PHONE/g, '')  // Remove spaced header (pdf2json)
                .replace(/\n/g, ' ')  // Replace line breaks with spaces
                .replace(/\s+/g, ' ')  // Normalize multiple spaces
                .trim();
            
            console.log('Cleaned text first 200 chars:');
            console.log(cleanedText.substring(0, 200));
            
            // Apply pattern
            const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s*(\d+)/g;
            const matches = Array.from(cleanedText.matchAll(nameNumberPattern));
            
            console.log(`\nFound ${matches.length} matches`);
            
            const members = [];
            for (let i = 0; i < Math.min(10, matches.length); i++) {
                const match = matches[i];
                if (!match[1] || !match[2]) continue;
                
                const rawName = match[1].trim();
                const amount = parseInt(match[2]);
                
                // Skip headers and invalid entries
                if (rawName.includes('NAME') || rawName.includes('LOAN') || 
                    rawName.includes('EMAIL') || rawName.includes('PHONE') ||
                    rawName.includes('TOTAL') || rawName.includes('SUM') ||
                    rawName.length < 5) {
                    console.log(`   ${i + 1}. SKIPPED: "${rawName}" - ${amount}`);
                    continue;
                }
                
                const properName = rawName.toLowerCase()
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                
                members.push({ name: properName, loanAmount: amount });
                console.log(`   ${i + 1}. ADDED: "${properName}" - ₹${amount.toLocaleString()}`);
            }
            
            // Check for SANTOSH MISHRA
            const santoshMember = members.find(m => m.name.toLowerCase().includes('santosh'));
            if (santoshMember) {
                console.log(`\n✅ SANTOSH MISHRA FOUND: ${santoshMember.name} - ₹${santoshMember.loanAmount.toLocaleString()}`);
            } else {
                console.log(`\n❌ SANTOSH MISHRA NOT FOUND in first 10 members`);
            }
            
            console.log('\n' + '='.repeat(50));
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testV28FinalFix();
