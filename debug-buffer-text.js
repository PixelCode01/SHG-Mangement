#!/usr/bin/env node

// Debug Buffer Text Extraction - Analyze what's in the production buffer text

console.log('🔍 DEBUGGING PRODUCTION BUFFER TEXT EXTRACTION');
console.log('=' .repeat(80));

const fs = require('fs');

async function analyzeBufferText() {
    const testFile = '/home/pixel/Downloads/members.pdf';
    
    if (!fs.existsSync(testFile)) {
        console.log('❌ Test PDF file not found:', testFile);
        return;
    }

    console.log('📁 Test file found:', testFile);
    console.log('📊 File size:', fs.statSync(testFile).size, 'bytes');
    console.log('');

    // Simulate buffer extraction like in production
    const buffer = fs.readFileSync(testFile);
    const bufferText = buffer.toString('utf8');
    
    console.log('📏 Buffer text length:', bufferText.length);
    console.log('');
    
    // Show first 1000 characters
    console.log('🔤 FIRST 1000 CHARACTERS:');
    console.log('-' .repeat(60));
    console.log(bufferText.substring(0, 1000));
    console.log('');
    
    // Show last 1000 characters
    console.log('🔤 LAST 1000 CHARACTERS:');
    console.log('-' .repeat(60));
    console.log(bufferText.substring(bufferText.length - 1000));
    console.log('');
    
    // Look for patterns we might recognize
    console.log('🔍 PATTERN ANALYSIS:');
    console.log('-' .repeat(60));
    
    // Look for uppercase words that might be names
    const uppercaseWords = bufferText.match(/[A-Z]{3,20}/g);
    if (uppercaseWords) {
        console.log('📝 Found uppercase words:', uppercaseWords.slice(0, 20));
    }
    
    // Look for common Indian names
    const commonNames = ['SANTOSH', 'ASHOK', 'ANUP', 'PRAMOD', 'MANOJ', 'VIKKI', 'SUNIL', 'PAWAN', 'SUDAMA', 'VIJAY'];
    const foundNames = [];
    
    for (const name of commonNames) {
        if (bufferText.includes(name)) {
            foundNames.push(name);
            const index = bufferText.indexOf(name);
            console.log(`✅ Found "${name}" at position ${index}`);
            console.log(`   Context: "${bufferText.substring(index - 20, index + 50)}"`);
        }
    }
    
    console.log('');
    console.log(`📊 Found ${foundNames.length} common names in buffer text`);
    
    // Look for number patterns
    const numberPatterns = bufferText.match(/\d{3,6}/g);
    if (numberPatterns) {
        console.log('🔢 Found number patterns:', numberPatterns.slice(0, 10));
    }
    
    console.log('');
    console.log('🏁 Buffer Text Analysis Complete!');
}

if (require.main === module) {
    analyzeBufferText().catch(console.error);
}
