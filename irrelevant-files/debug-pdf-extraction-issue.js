#!/usr/bin/env node

/**
 * DEBUG CLIENT-SIDE PDF EXTRACTION
 * 
 * This script simulates the client-side PDF extraction process 
 * to help understand why 1010 members are being extracted from 
 * a PDF that should only contain 50 members.
 */

console.log('🔍 DEBUGGING CLIENT-SIDE PDF EXTRACTION');
console.log('======================================');

// Simulate the problematic extraction logic
function debugProcessExtractedPDFLines(lines) {
    console.log(`\n📊 Processing ${lines.length} lines from PDF text`);
    
    // Debug the first few lines of text
    console.log("\n🔍 First 10 lines:", lines.slice(0, 10));
    console.log("\n🔍 Last 10 lines:", lines.slice(-10));
    
    // Create a single string for pattern matching
    const fullText = lines.join('\n');
    
    // Clean up the text to remove any problematic characters or patterns
    const cleanedText = fullText
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/[\r\n]+/g, '\n') // Normalize line endings
      .replace(/\n\s*\n/g, '\n'); // Remove empty lines
    
    console.log("\n📝 Cleaned text sample (first 500 chars):", cleanedText.substring(0, 500));
    console.log("\n📝 Cleaned text sample (last 500 chars):", cleanedText.substring(-500));
    
    const members = [];
    
    // METHOD 1: Look for SWAWLAMBAN format (NAMELOAN header)
    console.log('\n🔍 METHOD 1: Checking for SWAWLAMBAN format...');
    const isSwawlambanPDF = /NAMELOAN/i.test(fullText);
    console.log(`SWAWLAMBAN format detected: ${isSwawlambanPDF}`);
    
    if (isSwawlambanPDF) {
        console.log("Found NAMELOAN header - processing SWAWLAMBAN format");
        
        // Split the text into lines and clean them
        const cleanLines = fullText.split('\n')
            .map(line => line.trim())
            .filter(line => line && line !== 'NAMELOAN' && line !== 'AI');
        
        console.log(`Processing ${cleanLines.length} lines for SWAWLAMBAN format`);
        console.log("Sample lines:", cleanLines.slice(0, 5));
        
        let swawlambanCount = 0;
        for (const line of cleanLines) {
            // Pattern for name+amount concatenated: Name followed by digits at the end
            const match = line.match(/^([A-Z][A-Z\s\.\-\'\&]*[A-Z])\s*(\d+)$/);
            
            if (match?.[1] && match[2]) {
                const name = match[1].trim();
                const amount = match[2];
                
                // Validate that it's a reasonable name and amount
                if (name.length >= 3 && 
                    !name.includes('NAMELOAN') && 
                    !/\d/.test(name) && // No digits in name
                    amount.length >= 1 && amount.length <= 8) { // Reasonable loan amount length
                    
                    const parsedAmount = parseInt(amount);
                    console.log(`✅ SWAWLAMBAN format - Found: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
                    
                    members.push({ 
                        name: name, 
                        'loan amount': amount,
                        loanAmount: parsedAmount,
                        source: 'SWAWLAMBAN_METHOD_1'
                    });
                    swawlambanCount++;
                }
            } else {
                // Try alternate pattern where there might be a space or different separator
                const altMatch = line.match(/^([A-Z][A-Z\s\.\-\'\&]*)\s+(\d+)$/);
                if (altMatch?.[1] && altMatch[2]) {
                    const name = altMatch[1].trim();
                    const amount = altMatch[2];
                    
                    if (name.length >= 3 && !/\d/.test(name) && amount.length >= 1 && amount.length <= 8) {
                        const parsedAmount = parseInt(amount);
                        console.log(`✅ SWAWLAMBAN alt format - Found: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
                        
                        members.push({ 
                            name: name, 
                            'loan amount': amount,
                            loanAmount: parsedAmount,
                            source: 'SWAWLAMBAN_ALT_METHOD_1'
                        });
                        swawlambanCount++;
                    }
                }
            }
        }
        
        console.log(`\n📊 METHOD 1 RESULT: Found ${swawlambanCount} members with SWAWLAMBAN pattern`);
        
        if (members.length > 0) {
            // Clean up and validate the data before returning
            const validMembers = members.filter(m => {
                // Filter out suspicious entries that could be PDF metadata
                const name = m.name || '';
                if (name.includes('/') || 
                    name.includes('Type') || 
                    name.includes('Count') ||
                    name.includes('Subtype')) {
                    console.log(`⚠️ Filtering out invalid member: ${name}`);
                    return false;
                }
                return true;
            });
            
            console.log(`📊 After validation: ${validMembers.length} valid members`);
            if (validMembers.length > 0) {
                console.log('\n✅ METHOD 1 SUCCESS - Returning SWAWLAMBAN results');
                return validMembers;
            }
        } else {
            console.log("⚠️ No members found with SWAWLAMBAN pattern - will try other methods");
        }
    }

    // METHOD 2: Try to find NAME and LOAN headers
    console.log('\n🔍 METHOD 2: Looking for NAME/LOAN headers...');
    const nameHeaderPatterns = [/^NAME\s*$/i, /^MEMBER\s*NAME\s*$/i, /^MEMBERS\s*$/i];
    const loanHeaderPatterns = [/^LOAN\s*$/i, /^AMOUNT\s*$/i, /^LOAN\s*AMOUNT\s*$/i];
    
    let start = -1;
    let split = -1;
    
    // Find name header
    for (let i = 0; i < lines.length; i++) {
        const lineElement = lines[i];
        if (!lineElement) continue;
        const line = lineElement.trim();
        if (nameHeaderPatterns.some(pattern => pattern.test(line))) {
            start = i;
            break;
        }
    }
    
    // Find loan header after name header
    if (start >= 0) {
        for (let i = start + 1; i < lines.length; i++) {
            const lineElement = lines[i];
            if (!lineElement) continue;
            const line = lineElement.trim();
            if (loanHeaderPatterns.some(pattern => pattern.test(line))) {
                split = i;
                break;
            }
        }
    }
    
    console.log(`NAME section found at line ${start}, LOAN section found at line ${split}`);
    
    if (start >= 0 && split > start) {
        console.log("✅ Found structured NAME/LOAN format");
        
        // Process names section, skipping any lines that look like headers or are empty
        const names = lines.slice(start + 1, split)
            .map((l) => l.trim())
            .filter((l) => {
                return !!l && 
                       !/^(NAME|LOAN|AMOUNT|MEMBER|MEMBERS)\s*$/i.test(l) && 
                       l.length > 2;
            });
        
        // Process loan amounts section, filtering for numeric values
        const loans = lines.slice(split + 1)
            .map((l) => l.trim())
            .filter((l) => {
                return !!l && 
                       !/^(NAME|LOAN|AMOUNT|MEMBER|MEMBERS)\s*$/i.test(l) &&
                       /\d/.test(l); // Must contain at least one digit
            });
        
        console.log(`Found ${names.length} names and ${loans.length} loan amounts in sections`);
        
        // Match names with loan amounts, with better handling for when counts don't match
        const maxLength = Math.min(names.length, loans.length);
        let method2Count = 0;
        for (let i = 0; i < maxLength; i++) {
            const name = names[i];
            const loan = loans[i];
            if (name && name.length > 1) {
                // Clean any remaining header text from names
                const cleanName = name.replace(/^(NAME|LOAN|MEMBER)\s+/i, '').trim();
                
                // Clean and parse loan amount
                let loanAmount = loan || '0';
                // Remove any non-numeric characters except decimal points and commas
                loanAmount = loanAmount.replace(/[^\d,.]/g, '').trim();
                const parsedAmount = parseInt(loanAmount.replace(/,/g, '')) || 0;
                
                if (cleanName && !/^\//.test(cleanName)) { // Skip names starting with slash (likely PDF metadata)
                    console.log(`✅ NAME/LOAN format - Found: "${cleanName}" with amount "₹${parsedAmount.toLocaleString()}"`);
                    members.push({ 
                        name: cleanName, 
                        'loan amount': loanAmount,
                        loanAmount: parsedAmount,
                        source: 'NAME_LOAN_METHOD_2'
                    });
                    method2Count++;
                }
            }
        }
        
        console.log(`\n📊 METHOD 2 RESULT: Found ${method2Count} members with NAME/LOAN sections`);
        
        if (members.length > 0) {
            const filtered = members.filter(m => m.name && !m.name.includes('/')); // Final filter to remove any PDF metadata
            console.log(`After filtering: ${filtered.length} valid members`);
            if (filtered.length > 0) {
                console.log('\n✅ METHOD 2 SUCCESS - Returning NAME/LOAN results');
                return filtered;
            }
        }
    }

    // METHOD 3: Final fallback - Look for name-amount patterns anywhere
    console.log('\n🔍 METHOD 3: Fallback pattern matching...');
    
    // Pattern for detecting name followed by number (with possible separator)
    const nameAmountPattern = /([A-Z][A-Z\s\.\-\'\&]{2,})\s*[\:\s\.\-]?\s*(?:Rs\.?|₹)?\s*(\d[\d,\.]*)/g;
    const matches = [...fullText.matchAll(nameAmountPattern)];
    
    console.log(`Found ${matches.length} potential name-amount pairs with fallback pattern`);
    
    let method3Count = 0;
    for (const match of matches) {
        if (!match?.[1] || !match[2]) continue;
        
        const name = match[1].trim();
        let amount = match[2].trim();
        
        // Skip if name contains PDF metadata indicators
        if (name.includes('/') || name.includes('Type') || name.includes('Subtype') || name.includes('Count')) {
            continue;
        }
        
        // Skip very short names or likely non-names
        if (name.length < 3 || /\d/.test(name)) {
            continue;
        }
        
        // Parse amount
        amount = amount.replace(/[^\d,.]/g, '');
        const parsedAmount = parseInt(amount.replace(/,/g, '')) || 0;
        
        console.log(`✅ Fallback pattern - Found: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
        members.push({ 
            name, 
            'loan amount': amount,
            loanAmount: parsedAmount,
            source: 'FALLBACK_METHOD_3'
        });
        method3Count++;
    }
    
    console.log(`\n📊 METHOD 3 RESULT: Found ${method3Count} members with fallback pattern`);

    // METHOD 4: Look for name-amount pairs on the same line
    console.log('\n🔍 METHOD 4: Same-line name-amount pairs...');
    const nameAmountRegex = /([A-Za-z][A-Za-z\s\.\-\']+)\s+[₹Rs\.\s]*(\d[\d\,\.]*)/g;
    
    let match;
    let method4Count = 0;
    while ((match = nameAmountRegex.exec(fullText)) !== null) {
        if (!match?.[1] || !match[2]) continue;
        
        const name = match[1].trim();
        const amount = match[2].replace(/[^\d\.]/g, '');
        
        // Skip potential metadata
        if (name.includes('/') || name.includes('Type') || name.includes('Subtype') || name.includes('Count')) {
            console.log(`⚠️ Skipping potential metadata: "${name}"`);
            continue;
        }
        
        if (name && name.length > 1 && amount) {
            console.log(`Name-amount pair: "${name}" with amount "${amount}"`);
            members.push({ 
                name: name, 
                'loan amount': amount,
                source: 'SAME_LINE_METHOD_4'
            });
            method4Count++;
        }
    }
    
    console.log(`\n📊 METHOD 4 RESULT: Found ${method4Count} members with same-line pairs`);

    // METHOD 5: Uppercase names and numeric lines fallback
    console.log('\n🔍 METHOD 5: Uppercase pattern fallback...');
    
    if (members.length === 0) {
        console.log("Trying uppercase pattern fallback");
        
        // More flexible pattern for names (including hyphenated names, apostrophes)
        const namePattern = /^[A-Z][A-Z\s\.\-\']+[A-Z]$/;
        const names = lines.filter((l) => namePattern.test(l.trim()));
        
        // Pattern for amounts with optional currency symbols or commas
        const amountPattern = /^[₹Rs\.\s]*([\d\,\.]+)$/i;
        const loans = lines
            .map(l => {
                const match = l.trim().match(amountPattern);
                return match?.[1] || null;
            })
            .filter(l => l !== null);
        
        console.log(`Fallback method: Found ${names.length} potential names and ${loans.length} potential loan amounts`);
        
        let method5Count = 0;
        names.forEach((n, i) => {
            if (n && n.length > 1) {
                const loanAmount = i < loans.length ? loans[i] || '' : '';
                members.push({ 
                    name: n, 
                    'loan amount': loanAmount,
                    source: 'UPPERCASE_METHOD_5'
                });
                method5Count++;
            }
        });
        
        console.log(`\n📊 METHOD 5 RESULT: Found ${method5Count} members with uppercase pattern`);
    }

    // METHOD 6: Final desperate attempt - any valid member name patterns
    console.log('\n🔍 METHOD 6: Any valid member name patterns...');
    
    if (members.length === 0) {
        const potentialMemberPattern = /([A-Z][A-Z\s\.\-\']{2,}[A-Z])\b/g;
        const potentialMembers = new Set();
        
        while ((match = potentialMemberPattern.exec(fullText)) !== null) {
            if (!match?.[1]) continue;
            
            const name = match[1].trim();
            if (name && name.length > 3 && !/^\d+$/.test(name)) {
                potentialMembers.add(name);
            }
        }
        
        console.log(`Found ${potentialMembers.size} potential member names with no amounts`);
        
        let method6Count = 0;
        potentialMembers.forEach(name => {
            members.push({ 
                name: name, 
                'loan amount': '', // No amount found
                source: 'ANY_NAME_METHOD_6'
            });
            method6Count++;
        });
        
        console.log(`\n📊 METHOD 6 RESULT: Found ${method6Count} members with any name pattern`);
    }

    console.log(`\n📊 TOTAL EXTRACTED: ${members.length} members before filtering`);
    
    // Show breakdown by method
    const breakdown = {};
    members.forEach(m => {
        breakdown[m.source] = (breakdown[m.source] || 0) + 1;
    });
    console.log('\n📊 EXTRACTION BREAKDOWN BY METHOD:');
    Object.entries(breakdown).forEach(([method, count]) => {
        console.log(`  ${method}: ${count} members`);
    });
    
    // Final filtering
    console.log('\n🔍 APPLYING FINAL FILTERS...');
    
    const filteredMembers = members.map(m => {
        // Clean up name by removing any header text
        let name = m.name || m.Name || '';
        
        // Remove common header text patterns that might be prepended to names
        name = name.replace(/^(NAME\s+LOAN|NAME|LOAN)\s+/i, '');
        
        // Return the cleaned member object
        const cleanedMember = { ...m, name: name };
        // Remove the alternate field to avoid confusion
        delete cleanedMember.Name;
        return cleanedMember;
    }).filter(m => {
        const name = m.name || '';
        // Filter out entries that are likely not names
        const isValid = name.length > 1 && 
            !/^(NAME|LOAN|AMOUNT|TABLE|TOTAL|SL\.|NO\.)$/i.test(name) &&
            !/^\d+$/.test(name);
        
        if (!isValid) {
            console.log(`⚠️ Filtering out invalid name: "${name}"`);
        }
        
        return isValid;
    });
    
    console.log(`\n📊 After initial filtering: ${filteredMembers.length} valid members`);
    
    // FINAL SAFETY CHECK: Ensure no PDF metadata markers are in the results
    const finalMembers = filteredMembers.filter(m => {
        const name = m.name || '';
        if (name.includes('/') || 
            name.includes('Type') || 
            name.includes('Subtype') ||
            name.includes('Count') ||
            name.includes('Object') ||
            /^\//.test(name)) {
            console.log(`🚫 Filtering out PDF metadata: "${name}"`);
            return false;
        }
        return true;
    });
    
    console.log(`\n📊 FINAL RESULT: ${finalMembers.length} clean members without metadata markers`);
    
    // Show final breakdown by method
    const finalBreakdown = {};
    finalMembers.forEach(m => {
        finalBreakdown[m.source] = (finalBreakdown[m.source] || 0) + 1;
    });
    console.log('\n📊 FINAL BREAKDOWN BY METHOD:');
    Object.entries(finalBreakdown).forEach(([method, count]) => {
        console.log(`  ${method}: ${count} members`);
    });
    
    return finalMembers;
}

// Test with simulated problematic PDF content
console.log('\n🧪 TESTING WITH SIMULATED PROBLEMATIC PDF CONTENT');
console.log('=================================================');

// Simulate what might be causing 1010 members to be extracted
const problematicContent = [
    // Valid member entries (should be 3)
    'JOHN DOE 50000',
    'JANE SMITH 75000', 
    'MIKE JOHNSON 60000',
    // PDF metadata that might be getting picked up
    '/Type /Catalog',
    '/Count 1010', 
    '/Subtype /Widget',
    '/Creator Adobe Acrobat',
    // More potential noise
    'OBJECT 123',
    'REFERENCE 456',
    'STREAM DATA FOLLOWS',
    // Repeated patterns that might multiply
    ...Array(100).fill(0).map((_, i) => `ENTRY ${i + 1}`),
    ...Array(100).fill(0).map((_, i) => `DATA FIELD ${i + 1}`),
    ...Array(200).fill(0).map((_, i) => `METADATA VALUE ${i + 1}`),
    // Random text that could be mistaken for names
    ...Array(500).fill(0).map((_, i) => `RANDOM TEXT PATTERN ${i + 1}`),
    // More realistic but still problematic content
    'USER INTERFACE ELEMENT',
    'FORM CONTROL WIDGET',
    'NAVIGATION ELEMENT',
    'TABLE HEADER CELL',
    'TABLE DATA CELL'
];

console.log(`\n📊 Input: ${problematicContent.length} lines of simulated PDF content`);

const result = debugProcessExtractedPDFLines(problematicContent);

console.log('\n🎯 SUMMARY');
console.log('==========');
console.log(`📥 Input lines: ${problematicContent.length}`);
console.log(`📤 Extracted members: ${result.length}`);
console.log(`🎯 Expected members: 3`);
console.log(`❌ Excess members: ${result.length - 3}`);

if (result.length > 50) {
    console.log('\n⚠️  WARNING: Extraction is too permissive!');
    console.log('💡 SOLUTION: Need stricter validation and filtering');
} else {
    console.log('\n✅ Extraction looks reasonable');
}

console.log('\n📋 EXTRACTED MEMBER NAMES (first 20):');
result.slice(0, 20).forEach((member, i) => {
    console.log(`  ${i + 1}. "${member.name}" (${member.source})`);
});

if (result.length > 20) {
    console.log(`  ... and ${result.length - 20} more members`);
}
