const fs = require('fs');

// Test the fixed parsing logic
function testFixedParsing() {
    console.log('🧪 Testing Fixed PDF Parsing Logic...\n');
    
    // Read the extracted text
    const extractedTextPath = './extracted-text.txt';
    const fullText = fs.readFileSync(extractedTextPath, 'utf8');
    
    console.log('📄 Text length:', fullText.length);
    console.log('📖 First 200 characters:', fullText.substring(0, 200));
    
    // Clean up the text (same as in the component)
    const cleanedText = fullText
        .replace(/\u0000/g, '') // Remove null characters
        .replace(/[\r\n]+/g, '\n') // Normalize line endings
        .replace(/\n\s*\n/g, '\n'); // Remove empty lines
    
    const members = [];
    
    // Check for NAMELOAN pattern
    const isSwawlambanPDF = /NAMELOAN/i.test(fullText);
    console.log('🔍 NAMELOAN pattern found:', isSwawlambanPDF);
    
    if (isSwawlambanPDF) {
        console.log("✅ Found NAMELOAN header - processing SWAWLAMBAN format");
        
        // Split the text into lines and clean them
        const lines = fullText.split('\n')
            .map(line => line.trim())
            .filter(line => line && line !== 'NAMELOAN' && line !== 'AI');
        
        console.log(`📋 Processing ${lines.length} lines for SWAWLAMBAN format`);
        console.log("📝 Sample lines:", lines.slice(0, 5));
        
        for (const line of lines) {
            // Pattern for name+amount concatenated
            const match = line.match(/^([A-Z][A-Z\s\.\-\'\&]*[A-Z])\s*(\d+)$/);
            
            if (match) {
                const name = match[1].trim();
                const amount = match[2];
                
                // Validate that it's a reasonable name and amount
                if (name.length >= 3 && 
                    !name.includes('NAMELOAN') && 
                    !/\d/.test(name) && // No digits in name
                    amount.length >= 1 && amount.length <= 8) { // Reasonable loan amount length
                    
                    const parsedAmount = parseInt(amount);
                    console.log(`✅ Found: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
                    
                    members.push({ 
                        name: name, 
                        'loan amount': amount,
                        loanAmount: parsedAmount
                    });
                }
            } else {
                // Try alternate pattern where there might be a space
                const altMatch = line.match(/^([A-Z][A-Z\s\.\-\'\&]*)\s+(\d+)$/);
                if (altMatch) {
                    const name = altMatch[1].trim();
                    const amount = altMatch[2];
                    
                    if (name.length >= 3 && !/\d/.test(name) && amount.length >= 1 && amount.length <= 8) {
                        const parsedAmount = parseInt(amount);
                        console.log(`✅ Alt format - Found: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
                        
                        members.push({ 
                            name: name, 
                            'loan amount': amount,
                            loanAmount: parsedAmount
                        });
                    }
                }
            }
        }
    }
    
    console.log('\n🎯 FINAL RESULTS:');
    console.log(`✅ Successfully parsed ${members.length} members`);
    
    if (members.length > 0) {
        console.log('\n👥 Sample members:');
        members.slice(0, 10).forEach((member, index) => {
            console.log(`${index + 1}. ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
        });
        
        const membersWithLoans = members.filter(m => m.loanAmount > 0);
        const totalLoanAmount = members.reduce((sum, m) => sum + m.loanAmount, 0);
        
        console.log('\n📊 Statistics:');
        console.log(`- Total members: ${members.length}`);
        console.log(`- Members with loans: ${membersWithLoans.length}`);
        console.log(`- Members without loans: ${members.length - membersWithLoans.length}`);
        console.log(`- Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
    } else {
        console.log('❌ No members were parsed');
    }
    
    return members;
}

testFixedParsing();
