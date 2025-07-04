const fs = require('fs');

async function comparePdfExtractionMethods() {
    try {
        console.log('=== COMPARING PDF EXTRACTION METHODS ===\n');
        
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        const dataBuffer = fs.readFileSync(pdfPath);
        
        // Method 1: pdf-parse
        console.log('🔄 Method 1: pdf-parse');
        try {
            const pdf = require('pdf-parse');
            const pdfData = await pdf(dataBuffer);
            console.log('✅ pdf-parse successful');
            console.log('First 300 characters:');
            console.log(pdfData.text.substring(0, 300));
            console.log('\n' + '='.repeat(50) + '\n');
        } catch (error) {
            console.log('❌ pdf-parse failed:', error.message);
        }
        
        // Method 2: pdf2json
        console.log('🔄 Method 2: pdf2json');
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
            console.log('✅ pdf2json successful');
            console.log('First 300 characters:');
            console.log(pdf2jsonText.substring(0, 300));
            console.log('\n' + '='.repeat(50) + '\n');
            
            // Test our V28 extraction logic with pdf2json
            console.log('🧪 Testing V28 extraction with pdf2json text:');
            
            // Clean the text
            const cleanedText = pdf2jsonText
                .replace(/NAMELOANEMAILPHONE/g, '')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            console.log('Cleaned text first 200 chars:');
            console.log(cleanedText.substring(0, 200));
            
            // Apply pattern
            const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s*(\d+)/g;
            const matches = Array.from(cleanedText.matchAll(nameNumberPattern));
            
            console.log(`\nFound ${matches.length} matches with pdf2json`);
            console.log('First 10 matches:');
            matches.slice(0, 10).forEach((match, i) => {
                if (match[1] && match[2]) {
                    const name = match[1].trim();
                    const amount = match[2];
                    console.log(`   ${i + 1}. "${name}" - ${amount}`);
                }
            });
            
        } catch (error) {
            console.log('❌ pdf2json failed:', error.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

comparePdfExtractionMethods();
