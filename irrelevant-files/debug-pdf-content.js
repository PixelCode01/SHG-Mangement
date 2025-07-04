#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

async function debugPDFContent() {
    try {
        const fetch = (await import('node-fetch')).default;
        
        console.log('\n=== Debugging PDF Content ===\n');
        
        const testFile = '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf';
        
        if (!fs.existsSync(testFile)) {
            console.log('❌ Test file not found:', testFile);
            return;
        }
        
        // Use the original pdf-parse API to see the raw text
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile), {
            filename: 'SWAWLAMBAN till may 2025.pdf',
            contentType: 'application/pdf'
        });
        
        console.log('🔍 Getting raw PDF text from original API...');
        
        const response = await fetch('http://localhost:3000/api/pdf-parse', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Error response:', errorText);
            return;
        }
        
        const result = await response.json();
        
        if (result.success && result.pages) {
            const fullText = result.pages.join('\n');
            const lines = fullText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
            
            console.log('📄 Full PDF Text Analysis:');
            console.log('  - Total characters:', fullText.length);
            console.log('  - Total lines:', lines.length);
            
            console.log('\n📝 First 20 lines:');
            lines.slice(0, 20).forEach((line, i) => {
                console.log(`  ${(i + 1).toString().padStart(2, '0')}: "${line}"`);
            });
            
            console.log('\n🔍 Looking for header patterns:');
            lines.forEach((line, i) => {
                const lowerLine = line.toLowerCase();
                if (lowerLine.includes('name') && lowerLine.includes('loan')) {
                    console.log(`  Header found at line ${i + 1}: "${line}"`);
                }
            });
            
            console.log('\n🔍 Looking for SWAWLAMBAN patterns:');
            lines.forEach((line, i) => {
                if (/SWAWLAMBAN/i.test(line)) {
                    console.log(`  SWAWLAMBAN mention at line ${i + 1}: "${line}"`);
                }
            });
            
            console.log('\n🔍 Looking for name-amount patterns:');
            let count = 0;
            lines.forEach((line, i) => {
                const nameAmountMatch = line.match(/^([A-Z\s]+?)\s+(\d+)$/);
                if (nameAmountMatch && count < 10) {
                    const [, name, amount] = nameAmountMatch;
                    console.log(`  Pattern at line ${i + 1}: "${name.trim()}" -> ${amount}`);
                    count++;
                }
            });
            
            if (count === 0) {
                console.log('  No name-amount patterns found with current regex');
                console.log('\n🔍 Checking all lines with numbers:');
                let numCount = 0;
                lines.forEach((line, i) => {
                    if (/\d+/.test(line) && numCount < 10) {
                        console.log(`  Line ${i + 1} with numbers: "${line}"`);
                        numCount++;
                    }
                });
            }
            
            // Save the text for manual inspection
            fs.writeFileSync('/tmp/debug-pdf-text.txt', fullText);
            console.log('\n💾 Full PDF text saved to: /tmp/debug-pdf-text.txt');
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugPDFContent();
