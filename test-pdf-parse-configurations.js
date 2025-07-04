#!/usr/bin/env node

// Test different pdf-parse configurations to find one that works reliably in production

const fs = require('fs');

console.log('🧪 Testing PDF-Parse Production Configurations');
console.log('=' .repeat(60));

async function testPDFParseConfigurations() {
  const pdfPath = '/home/pixel/Downloads/members.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ members.pdf not found');
    return;
  }
  
  const buffer = fs.readFileSync(pdfPath);
  console.log(`📄 PDF loaded: ${buffer.length} bytes`);
  
  // Test 1: Standard pdf-parse
  console.log('\n🔬 Test 1: Standard pdf-parse');
  try {
    const pdf = require('pdf-parse');
    const result = await pdf(buffer);
    console.log(`✅ Standard: ${result.text.length} chars, ${result.numpages} pages`);
    console.log('Sample text:', result.text.substring(0, 200));
  } catch (error) {
    console.log('❌ Standard failed:', error.message);
  }
  
  // Test 2: With explicit options
  console.log('\n🔬 Test 2: With explicit options');
  try {
    const pdf = require('pdf-parse');
    const result = await pdf(buffer, {
      max: 0, // Parse all pages
      version: 'v1.10.100'
    });
    console.log(`✅ With options: ${result.text.length} chars, ${result.numpages} pages`);
    console.log('Sample text:', result.text.substring(0, 200));
  } catch (error) {
    console.log('❌ With options failed:', error.message);
  }
  
  // Test 3: With render options
  console.log('\n🔬 Test 3: With render options');
  try {
    const pdf = require('pdf-parse');
    const result = await pdf(buffer, {
      max: 0,
      normalizeWhitespace: false,
      disableCombineTextItems: false
    });
    console.log(`✅ With render options: ${result.text.length} chars, ${result.numpages} pages`);
    console.log('Sample text:', result.text.substring(0, 200));
  } catch (error) {
    console.log('❌ With render options failed:', error.message);
  }
  
  // Test 4: Try to simulate Vercel environment issues
  console.log('\n🔬 Test 4: Simulating potential Vercel issues');
  try {
    // Clear require cache to simulate fresh import
    delete require.cache[require.resolve('pdf-parse')];
    
    const pdf = require('pdf-parse');
    
    // Use minimal, safe options
    const result = await pdf(buffer, {
      max: 0
    });
    
    console.log(`✅ Fresh import: ${result.text.length} chars, ${result.numpages} pages`);
    
    // Extract specific member count
    const lines = result.text.split('\n').filter(line => line.trim().length > 0);
    const memberLines = lines.filter(line => {
      return /^[A-Z][A-Z\s]+?\d*$/.test(line) && line.includes(' ') && line.length > 5;
    });
    
    console.log(`📊 Total lines: ${lines.length}, Member-like lines: ${memberLines.length}`);
    
    // Show first few member lines
    console.log('📋 Sample member lines:');
    memberLines.slice(0, 10).forEach((line, index) => {
      console.log(`   ${index + 1}. ${line}`);
    });
    
  } catch (error) {
    console.log('❌ Fresh import failed:', error.message);
    console.log('Stack trace:', error.stack);
  }
  
  // Test 5: Check for specific error patterns that might occur in Vercel
  console.log('\n🔬 Test 5: Environment compatibility check');
  
  try {
    const os = require('os');
    const process = require('process');
    
    console.log('🖥️  Environment details:');
    console.log(`   Platform: ${os.platform()}`);
    console.log(`   Architecture: ${os.arch()}`);
    console.log(`   Node version: ${process.version}`);
    console.log(`   Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    // Check if pdf-parse dependencies are available
    const pdf = require('pdf-parse');
    console.log('✅ pdf-parse module loaded successfully');
    
    // Try a minimal parse to check for dependency issues
    const smallBuffer = buffer.slice(0, 1000);
    try {
      await pdf(smallBuffer);
      console.log('✅ Partial parse works (dependencies OK)');
    } catch (partialError) {
      console.log('⚠️  Partial parse failed:', partialError.message);
    }
    
  } catch (error) {
    console.log('❌ Environment check failed:', error.message);
  }
}

testPDFParseConfigurations().catch(console.error);
