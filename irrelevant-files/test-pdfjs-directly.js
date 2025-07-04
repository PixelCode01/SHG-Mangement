const fs = require('fs');
const path = require('path');

async function testPdfJs() {
  try {
    console.log('🔍 Testing PDF.js directly...');
    
    // Try to import pdfjs-dist legacy
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    console.log('✅ PDF.js imported successfully');
    
    // Check if we have any test PDF files
    const testPdfPath = path.join(__dirname, 'tmp', 'test.pdf');
    if (fs.existsSync(testPdfPath)) {
      console.log('📁 Found test PDF file');
      
      const buffer = fs.readFileSync(testPdfPath);
      console.log(`📊 PDF buffer size: ${buffer.length} bytes`);
      
      // Try to parse with PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      
      console.log(`✅ PDF.js parsed successfully - Pages: ${pdf.numPages}`);
      
      // Extract text from first page
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      
      console.log(`📝 First page text length: ${pageText.length}`);
      console.log(`🔍 First 200 characters: "${pageText.substring(0, 200)}"`);
      
    } else {
      console.log('⚠️  No test PDF file found');
    }
    
  } catch (error) {
    console.error('❌ PDF.js test failed:', error);
  }
}

testPdfJs();
