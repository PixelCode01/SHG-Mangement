const fs = require('fs');

async function testPdfParsing() {
  try {
    console.log('Testing PDF parsing with the SWAWLAMBAN file...');
    
    // Import pdf-parse
    const pdfParse = require('pdf-parse');
    
    // Read the PDF file
    const pdfPath = '/home/pixel/aichat/SHG-Mangement-main/public/swawlamban-may-2025.pdf';
    const dataBuffer = fs.readFileSync(pdfPath);
    
    console.log(`PDF file size: ${dataBuffer.length} bytes`);
    
    // Parse the PDF
    const data = await pdfParse(dataBuffer);
    
    console.log(`✅ PDF parsed successfully!`);
    console.log(`📊 Number of pages: ${data.numpages}`);
    console.log(`📝 Text length: ${data.text.length} characters`);
    console.log(`🔍 Text preview (first 500 chars):`);
    console.log(data.text.substring(0, 500));
    
    // Check for SWAWLAMBAN patterns
    const hasSwawlamban = data.text.includes('SWAWLAMBAN');
    const hasNames = /[A-Z][A-Z\s\.]{3,}[A-Z]/.test(data.text);
    const hasAmounts = /\d{4,}/.test(data.text);
    
    console.log(`\n📌 Format detection:`);
    console.log(`- Contains "SWAWLAMBAN": ${hasSwawlamban}`);
    console.log(`- Has uppercase names: ${hasNames}`);
    console.log(`- Has amount patterns: ${hasAmounts}`);
    
    return {
      success: true,
      pages: data.numpages,
      textLength: data.text.length,
      text: data.text
    };
  } catch (error) {
    console.error('❌ PDF parsing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
testPdfParsing().then(result => {
  if (result.success) {
    console.log('\n✅ PDF parsing test PASSED');
  } else {
    console.log('\n❌ PDF parsing test FAILED');
  }
});
