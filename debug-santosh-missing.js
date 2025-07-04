const fs = require('fs');
const pdf = require('pdf-parse');

async function debugSantoshMissing() {
    try {
        console.log('=== DEBUGGING SANTOSH MISHRA EXTRACTION ===\n');
        
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        
        console.log('Raw PDF text (first 1000 characters):');
        console.log(data.text.substring(0, 1000));
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Split into lines and analyze
        const lines = data.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        console.log('All lines with indices:');
        lines.forEach((line, index) => {
            console.log(`${index}: "${line}"`);
            if (index > 20) return false; // Stop after showing first 20 lines
        });
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Look for name patterns
        const namePattern = /^[A-Z][A-Z\s]+$/;
        const names = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip headers
            if (line === 'NAME' || line === 'LOAN' || line === 'EMAIL' || line === 'PHONE') {
                continue;
            }
            
            // Skip numbers
            if (/^\d+$/.test(line)) {
                continue;
            }
            
            // Check if it's a name
            if (namePattern.test(line) && line.length > 2) {
                names.push({
                    index: i,
                    name: line
                });
            }
        }
        
        console.log('Extracted names with their line indices:');
        names.forEach((item, index) => {
            console.log(`${index + 1}. Line ${item.index}: "${item.name}"`);
        });
        
        console.log(`\nTotal names found: ${names.length}`);
        
        // Check specifically for SANTOSH MISHRA
        const santoshIndex = lines.findIndex(line => line.includes('SANTOSH MISHRA'));
        console.log(`\nSANTOSH MISHRA found at line index: ${santoshIndex}`);
        if (santoshIndex >= 0) {
            console.log(`Line content: "${lines[santoshIndex]}"`);
            console.log('Context lines:');
            for (let i = Math.max(0, santoshIndex - 2); i <= Math.min(lines.length - 1, santoshIndex + 2); i++) {
                console.log(`  ${i}: "${lines[i]}"`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugSantoshMissing();
