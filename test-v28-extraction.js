const fs = require('fs');
const pdf = require('pdf-parse');

async function testV28Extraction() {
    try {
        console.log('=== TESTING V28 EXTRACTION LOGIC ===\n');
        
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        
        console.log('Raw PDF text (first 500 characters):');
        console.log(data.text.substring(0, 500));
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Apply the V28 extraction pattern
        const allText = data.text;
        
        // V28 Pattern: NAME followed by NUMBER (handles both "SANTOSH MISHRA 178604" and "SANTOSH MISHRA178604" formats)
        const nameNumberPattern = /([A-Z][A-Z\s]{4,40}?)\s*(\d+)/g;
        
        const matches = Array.from(allText.matchAll(nameNumberPattern));
        console.log(`Found ${matches.length} name-number patterns:`);
        
        const members = [];
        
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
                console.log(`   ${i + 1}. SKIPPED (header/invalid): "${rawName}" - ${amount}`);
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
                
                console.log(`   ${i + 1}. ADDED: "${properName}" - ₹${amount.toLocaleString()}`);
            } else {
                console.log(`   ${i + 1}. SKIPPED (format): "${properName}" - ${amount}`);
            }
        }
        
        // Remove duplicates by name
        const uniqueMembers = members.filter((member, index, self) => 
            index === self.findIndex(m => m.name.toLowerCase() === member.name.toLowerCase())
        );
        
        console.log('\n' + '='.repeat(50));
        console.log(`\nFINAL RESULTS:`);
        console.log(`Total matches found: ${matches.length}`);
        console.log(`Valid members extracted: ${members.length}`);
        console.log(`Unique members: ${uniqueMembers.length}`);
        
        const totalLoanAmount = uniqueMembers.reduce((sum, member) => sum + member.loanAmount, 0);
        console.log(`Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
        
        console.log('\nFirst 10 members:');
        uniqueMembers.slice(0, 10).forEach((member, i) => {
            console.log(`   ${i + 1}. ${member.name} - ₹${member.loanAmount.toLocaleString()}`);
        });
        
        // Check for SANTOSH MISHRA specifically
        const santoshMember = uniqueMembers.find(m => m.name.toLowerCase().includes('santosh'));
        if (santoshMember) {
            console.log(`\n✅ SANTOSH MISHRA FOUND: ${santoshMember.name} - ₹${santoshMember.loanAmount.toLocaleString()}`);
        } else {
            console.log(`\n❌ SANTOSH MISHRA NOT FOUND in extracted members`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testV28Extraction();
