#!/usr/bin/env node

/**
 * Test different approaches to import PDF libraries for Vercel compatibility
 */

console.log('🧪 Testing PDF Library Import Compatibility');
console.log('===========================================');

async function testImports() {
  console.log('1️⃣ Testing pdf-parse dynamic import...');
  try {
    const { default: pdf } = await import('pdf-parse');
    console.log('✅ pdf-parse dynamic import successful');
  } catch (error) {
    console.log('❌ pdf-parse dynamic import failed:', error.message);
  }

  console.log('\n2️⃣ Testing pdf2json dynamic import...');
  try {
    const PDFParser = (await import('pdf2json')).default;
    console.log('✅ pdf2json dynamic import successful');
  } catch (error) {
    console.log('❌ pdf2json dynamic import failed:', error.message);
  }

  console.log('\n3️⃣ Testing pdf-parse static import...');
  try {
    const pdf = require('pdf-parse');
    console.log('✅ pdf-parse static import successful');
  } catch (error) {
    console.log('❌ pdf-parse static import failed:', error.message);
  }

  console.log('\n4️⃣ Testing pdf2json static import...');
  try {
    const PDFParser = require('pdf2json');
    console.log('✅ pdf2json static import successful');
  } catch (error) {
    console.log('❌ pdf2json static import failed:', error.message);
  }
}

testImports();
