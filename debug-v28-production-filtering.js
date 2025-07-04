const fs = require('fs');
const FormData = require('form-data');

async function debugV28ProductionFiltering() {
    try {
        console.log('=== DEBUGGING V28 PRODUCTION FILTERING ===\n');
        
        // Simulate the exact same logic as in our API
        
        // Step 1: Get the text in the same way pdf2json would
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        const dataBuffer = fs.readFileSync(pdfPath);
        
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
        
        const allText = await extractWithPdf2json();
        console.log('PDF2JSON extracted text length:', allText.length);
        console.log('First 400 characters:');
        console.log(allText.substring(0, 400));
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Step 2: Apply V28 cleaning logic
        const cleanedText = allText
            .replace(/NAMELOANEMAILPHONE/g, '')  // Remove concatenated header (pdf-parse)
            .replace(/NAME\s+LOAN\s+EMAIL\s+PHONE/g, '')  // Remove spaced header (pdf2json)
            .replace(/\n/g, ' ')  // Replace line breaks with spaces
            .replace(/\s+/g, ' ')  // Normalize multiple spaces
            .trim();
            
        console.log('Cleaned text length:', cleanedText.length);
        console.log('First 200 characters:');
        console.log(cleanedText.substring(0, 200));
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Step 3: Apply pattern
        const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s*(\d+)/g;
        const matches = Array.from(cleanedText.matchAll(nameNumberPattern));
        console.log(`Found ${matches.length} matches`);
        
        // Step 4: Apply filtering logic (same as API)
        const members = [];
        
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            if (!match[1] || !match[2]) {
                console.log(`   ${i + 1}. SKIPPED (no match): ${match[0]}`);
                continue;
            }
            
            const rawName = match[1].trim();
            const amount = parseInt(match[2]);
            
            console.log(`   ${i + 1}. Processing: "${rawName}" - ${amount}`);
            
            // Skip headers and invalid entries
            if (rawName.includes('NAME') || rawName.includes('LOAN') || 
                rawName.includes('EMAIL') || rawName.includes('PHONE') ||
                rawName.includes('TOTAL') || rawName.includes('SUM') ||
                rawName.length < 5) {
                console.log(`      -> SKIPPED (header/invalid): length=${rawName.length}`);
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
                    loanAmount: amount
                });
                
                console.log(`      -> ADDED: "${properName}" - ₹${amount.toLocaleString()}`);
            } else {
                console.log(`      -> SKIPPED (format): words=${nameWords.length}, length=${properName.length}`);
            }
        }
        
        console.log(`\nFinal results: ${members.length} members`);
        
        // Check specifically for SANTOSH MISHRA
        const santoshMember = members.find(m => m.name.toLowerCase().includes('santosh'));
        if (santoshMember) {
            console.log(`✅ SANTOSH MISHRA FOUND: ${santoshMember.name}`);
        } else {
            console.log(`❌ SANTOSH MISHRA NOT FOUND`);
            
            // Check if it was in the matches but filtered out
            const santoshMatch = matches.find(m => m[1] && m[1].toLowerCase().includes('santosh'));
            if (santoshMatch) {
                console.log(`🔍 SANTOSH was in matches but filtered: "${santoshMatch[1]}" - ${santoshMatch[2]}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugV28ProductionFiltering();
