#!/usr/bin/env node

/**
 * Local PDF Analysis Tool
 * This script will help analyze the members.pdf file to understand its structure
 * and determine the best extraction approach
 */

const fs = require('fs');
const path = require('path');

function analyzePDF(pdfPath) {
    console.log('🔍 LOCAL PDF ANALYSIS TOOL');
    console.log('=' .repeat(80));
    
    try {
        // Check if file exists
        if (!fs.existsSync(pdfPath)) {
            console.log(`❌ File not found: ${pdfPath}`);
            console.log('📋 Please check the file path and try again.');
            return;
        }
        
        // Get file stats
        const stats = fs.statSync(pdfPath);
        console.log(`📄 File: ${path.basename(pdfPath)}`);
        console.log(`📏 Size: ${Math.round(stats.size / 1024)}KB (${stats.size} bytes)`);
        console.log(`📅 Modified: ${stats.mtime.toISOString()}`);
        
        // Read first few bytes to confirm it's a PDF
        const buffer = fs.readFileSync(pdfPath);
        const header = buffer.slice(0, 10).toString();
        
        console.log(`🔍 File header: "${header}"`);
        
        if (!header.startsWith('%PDF-')) {
            console.log('❌ This does not appear to be a valid PDF file');
            return;
        }
        
        // Extract PDF version
        const version = header.match(/%PDF-(\d+\.\d+)/);
        if (version) {
            console.log(`📋 PDF Version: ${version[1]}`);
        }
        
        // Try to extract some text content using simple string search
        console.log('\n🔍 CONTENT ANALYSIS');
        console.log('-'.repeat(50));
        
        const content = buffer.toString('latin1');
        
        // Look for common member-related keywords
        const keywords = ['name', 'member', 'loan', 'amount', 'rupees', 'rs', '₹'];
        const foundKeywords = [];
        
        keywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            const matches = content.match(regex);
            if (matches && matches.length > 0) {
                foundKeywords.push(`${keyword}: ${matches.length} occurrences`);
            }
        });
        
        if (foundKeywords.length > 0) {
            console.log('📝 Found keywords:');
            foundKeywords.forEach(kw => console.log(`  - ${kw}`));
        } else {
            console.log('⚠️ No obvious member-related keywords found');
        }
        
        // Look for number patterns that could be amounts
        const numberPattern = /\b\d{3,8}\b/g;
        const numbers = content.match(numberPattern);
        if (numbers && numbers.length > 0) {
            const uniqueNumbers = [...new Set(numbers)].slice(0, 20);
            console.log(`🔢 Found ${numbers.length} number patterns (showing first 20 unique):`);
            console.log(`  ${uniqueNumbers.join(', ')}`);
        }
        
        // Look for name patterns (capitalized words)
        const namePattern = /\b[A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{2,15}){0,3}\b/g;
        const names = content.match(namePattern);
        if (names && names.length > 0) {
            const uniqueNames = [...new Set(names)].slice(0, 15);
            console.log(`👥 Found ${names.length} potential name patterns (showing first 15 unique):`);
            uniqueNames.forEach(name => console.log(`  - ${name}`));
        }
        
        console.log('\n📋 RECOMMENDATIONS');
        console.log('-'.repeat(50));
        console.log('Based on this analysis:');
        
        if (foundKeywords.length > 2) {
            console.log('✅ PDF appears to contain member data');
            console.log('📋 Best approach:');
            console.log('   1. Open PDF in a viewer (Adobe Reader, Chrome, etc.)');
            console.log('   2. Select and copy the member list section');
            console.log('   3. Paste into a text file to see the structure');
            console.log('   4. Create a simple CSV with: Name, Loan Amount');
            console.log('   5. Import the CSV instead of PDF');
        } else {
            console.log('⚠️ PDF structure may be complex or image-based');
            console.log('📋 Try these approaches:');
            console.log('   1. Use a PDF-to-text converter tool');
            console.log('   2. Copy data manually from PDF viewer');
            console.log('   3. If it\'s a scanned PDF, use OCR software');
        }
        
        console.log('\n💡 ALTERNATIVE WORKFLOW');
        console.log('-'.repeat(50));
        console.log('Create a simple text file like this:');
        console.log('```');
        console.log('Sunita Sharma,15000');
        console.log('Radha Devi,12000');
        console.log('Kamala Singh,18000');
        console.log('... (for all 50 members)');
        console.log('```');
        console.log('Then use manual member creation in the web app.');
        
    } catch (error) {
        console.error('❌ Error analyzing PDF:', error.message);
        console.log('📋 This might be a permissions issue or corrupted file.');
    }
}

// Check command line arguments
const pdfPath = process.argv[2] || '/home/pixel/Downloads/members.pdf';

console.log('🔧 PDF ANALYSIS STARTING...');
console.log(`📂 Target file: ${pdfPath}`);
console.log('');

analyzePDF(pdfPath);

console.log('\n' + '='.repeat(80));
console.log('🎯 ANALYSIS COMPLETE');
console.log('📞 If you need help interpreting results, share the output above.');
