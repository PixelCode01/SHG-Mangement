const fs = require('fs');

async function checkForDuplicateNames() {
    try {
        console.log('=== CHECKING FOR DUPLICATE NAMES ===\n');
        
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
        
        // Apply V28 cleaning logic
        const cleanedText = allText
            .replace(/NAMELOANEMAILPHONE/g, '')
            .replace(/NAME\s+LOAN\s+EMAIL\s+PHONE/g, '')
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s*(\d+)/g;
        const matches = Array.from(cleanedText.matchAll(nameNumberPattern));
        
        const allMembers = [];
        
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            if (!match[1] || !match[2]) continue;
            
            const rawName = match[1].trim();
            const amount = parseInt(match[2]);
            
            // Skip headers and invalid entries
            if (rawName.includes('NAME') || rawName.includes('LOAN') || 
                rawName.includes('EMAIL') || rawName.includes('PHONE') ||
                rawName.includes('TOTAL') || rawName.includes('SUM') ||
                rawName.length < 5) {
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
                
                allMembers.push({
                    index: i,
                    name: properName,
                    loanAmount: amount,
                    lowercaseName: properName.toLowerCase()
                });
            }
        }
        
        console.log(`Total valid members before duplicate removal: ${allMembers.length}`);
        
        // Check for duplicates
        const duplicates = new Map();
        allMembers.forEach(member => {
            if (!duplicates.has(member.lowercaseName)) {
                duplicates.set(member.lowercaseName, []);
            }
            duplicates.get(member.lowercaseName).push(member);
        });
        
        console.log('\nChecking for duplicates:');
        let foundDuplicates = false;
        duplicates.forEach((members, name) => {
            if (members.length > 1) {
                foundDuplicates = true;
                console.log(`❌ DUPLICATE: "${name}" appears ${members.length} times:`);
                members.forEach(member => {
                    console.log(`   Index ${member.index}: ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
                });
            }
        });
        
        if (!foundDuplicates) {
            console.log('✅ No duplicates found');
        }
        
        // Apply duplicate removal logic
        const uniqueMembers = allMembers.filter((member, index, self) => 
            index === self.findIndex(m => m.lowercaseName === member.lowercaseName)
        );
        
        console.log(`\nAfter duplicate removal: ${uniqueMembers.length} members`);
        
        // Check if SANTOSH MISHRA survived
        const santoshMember = uniqueMembers.find(m => m.lowercaseName.includes('santosh'));
        if (santoshMember) {
            console.log(`✅ SANTOSH MISHRA survived: ${santoshMember.name} - ₹${santoshMember.loanAmount.toLocaleString()}`);
        } else {
            console.log(`❌ SANTOSH MISHRA did not survive duplicate removal`);
            
            // Check if it was in the original list
            const originalSantosh = allMembers.find(m => m.lowercaseName.includes('santosh'));
            if (originalSantosh) {
                console.log(`🔍 SANTOSH was in original list: ${originalSantosh.name} at index ${originalSantosh.index}`);
            }
        }
        
        console.log('\nFirst 10 unique members:');
        uniqueMembers.slice(0, 10).forEach((member, i) => {
            console.log(`   ${i + 1}. ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkForDuplicateNames();
