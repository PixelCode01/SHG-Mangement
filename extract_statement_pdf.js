const fs = require('fs');
const PDFParser = require('pdf2json');

async function extractPdfContent(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_dataError', (errData) => {
            reject(new Error(`PDF2JSON Error: ${errData.parserError}`));
        });
        
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            try {
                let extractedText = '';
                
                if (pdfData.Pages) {
                    for (const page of pdfData.Pages) {
                        if (page.Texts) {
                            for (const text of page.Texts) {
                                if (text.R) {
                                    for (const run of text.R) {
                                        if (run.T) {
                                            extractedText += decodeURIComponent(run.T) + ' ';
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                resolve(extractedText);
            } catch (error) {
                reject(error);
            }
        });
        
        const dataBuffer = fs.readFileSync(pdfPath);
        pdfParser.parseBuffer(dataBuffer);
    });
}

async function main() {
    const pdfPath = '/home/pixel/aichat/SHG-Mangement-main/tmp/STATEMENT MAY- 2025.pdf';
    
    console.log('Starting PDF extraction...');
    console.log('PDF Path:', pdfPath);
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
        console.error('PDF file not found:', pdfPath);
        return;
    }
    
    console.log('PDF file exists, proceeding with extraction...');
    
    try {
        console.log('Extracting content from:', pdfPath);
        const content = await extractPdfContent(pdfPath);
        
        console.log('\n' + '='.repeat(60));
        console.log('EXTRACTED PDF CONTENT:');
        console.log('='.repeat(60));
        console.log(content);
        console.log('='.repeat(60));
        
        // Save to file for reference
        const outputFile = '/home/pixel/aichat/SHG-Mangement-main/pdf_statement_content.txt';
        fs.writeFileSync(outputFile, content);
        console.log(`\nContent saved to: ${outputFile}`);
        
        // Look for specific financial terms
        console.log('\n' + '='.repeat(60));
        console.log('ANALYZING FINANCIAL TERMS:');
        console.log('='.repeat(60));
        
        const lines = content.split('\n').filter(line => line.trim());
        const relevantLines = lines.filter(line => {
            const lowerLine = line.toLowerCase();
            return lowerLine.includes('fund') || 
                   lowerLine.includes('standing') || 
                   lowerLine.includes('cash') || 
                   lowerLine.includes('bank') || 
                   lowerLine.includes('total') || 
                   lowerLine.includes('amount') || 
                   lowerLine.includes('balance') ||
                   lowerLine.includes('gs') ||
                   lowerLine.includes('li') ||
                   lowerLine.includes('loan') ||
                   lowerLine.includes('group');
        });
        
        console.log('Relevant financial lines found:');
        relevantLines.forEach((line, index) => {
            console.log(`${index + 1}. ${line.trim()}`);
        });
        
    } catch (error) {
        console.error('Error extracting PDF:', error);
    }
}

main();
