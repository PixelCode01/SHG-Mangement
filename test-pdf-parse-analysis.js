#!/usr/bin/env node

/**
 * Test script to analyze PDF text extracted by pdf-parse
 */

const fs = require('fs');
const path = require('path');

async function testPDFParseExtraction() {
    console.log('🧪 TESTING PDF-PARSE TEXT EXTRACTION');
    console.log('=====================================');
    
    const pdfPath = '/home/pixel/Downloads/members.pdf';
    
    if (!fs.existsSync(pdfPath)) {
        console.log('❌ Test PDF file not found:', pdfPath);
        return;
    }
    
    try {
        // Import pdf-parse
        const { default: pdf } = await import('pdf-parse');
        console.log('✅ pdf-parse imported successfully');
        
        // Read file as buffer
        const fileBuffer = fs.readFileSync(pdfPath);
        console.log('📄 File size:', fileBuffer.length, 'bytes');
        
        // Extract text
        console.log('📖 Extracting text with pdf-parse...');
        const pdfData = await pdf(fileBuffer);
        const extractedText = pdfData.text;
        
        console.log('✅ Text extracted successfully');
        console.log('📝 Extracted text length:', extractedText.length);
        console.log('📄 Total pages:', pdfData.numpages);
        console.log('📋 Metadata:', JSON.stringify(pdfData.info, null, 2));
        
        console.log('\n📃 Full extracted text:');
        console.log('=' * 50);
        console.log(extractedText);
        console.log('=' * 50);
        
        // Analyze lines
        const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        console.log('\n📋 Total lines found:', lines.length);
        
        console.log('\n📃 All lines:');
        lines.forEach((line, i) => {
            console.log(`${String(i + 1).padStart(3, ' ')}: ${line}`);
        });
        
        // Test different name extraction patterns
        console.log('\n🔍 Testing different extraction patterns:');
        
        // Pattern 1: All caps name followed by number
        console.log('\n1. All caps name + number pattern:');
        const pattern1 = /([A-Z][A-Z\s]{4,30})\s+(\d+(?:\.\d+)?)/g;
        let matches = Array.from(extractedText.matchAll(pattern1));
        matches.forEach((match, i) => {
            console.log(`   ${i + 1}. "${match[1].trim()}" - ${match[2]}`);
        });
        
        // Pattern 2: Mixed case names
        console.log('\n2. Mixed case name + number pattern:');
        const pattern2 = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+(?:\.\d+)?)/g;
        matches = Array.from(extractedText.matchAll(pattern2));
        matches.forEach((match, i) => {
            console.log(`   ${i + 1}. "${match[1].trim()}" - ${match[2]}`);
        });
        
        // Pattern 3: Line by line analysis
        console.log('\n3. Line-by-line name search:');
        lines.forEach((line, i) => {
            // Look for patterns like "name number" or "number name"
            const nameFirst = line.match(/^([A-Za-z\s]{3,40})\s+(\d+(?:\.\d+)?)$/);
            const numberFirst = line.match(/^(\d+(?:\.\d+)?)\s+([A-Za-z\s]{3,40})$/);
            
            if (nameFirst) {
                console.log(`   Line ${i + 1} (name first): "${nameFirst[1].trim()}" - ${nameFirst[2]}`);
            } else if (numberFirst) {
                console.log(`   Line ${i + 1} (number first): "${numberFirst[2].trim()}" - ${numberFirst[1]}`);
            }
        });
        
        // Pattern 4: Any word that looks like a name
        console.log('\n4. Potential names (any capitalized words):');
        const words = extractedText.match(/[A-Z][a-z]+/g) || [];
        const uniqueWords = [...new Set(words)].filter(word => 
            word.length >= 3 && 
            !['PDF', 'Page', 'Date', 'Total', 'Name', 'Amount'].includes(word)
        );
        console.log('   Potential name words:', uniqueWords.slice(0, 20).join(', '));
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testPDFParseExtraction().catch(console.error);
