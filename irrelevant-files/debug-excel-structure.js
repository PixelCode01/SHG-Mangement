const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function debugExcelStructure() {
  try {
    const filePath = '/home/pixel/Downloads/loan_data_no_dashes.xlsx';
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found:', filePath);
      return;
    }
    
    console.log('📊 Analyzing Excel file structure...');
    console.log('File path:', filePath);
    
    // Load the workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    // Get the first worksheet
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) {
      console.log('❌ No worksheets found in the file');
      return;
    }
    
    console.log('\n📋 Worksheet Info:');
    console.log(`- Name: ${worksheet.name}`);
    console.log(`- Row count: ${worksheet.rowCount}`);
    console.log(`- Column count: ${worksheet.columnCount}`);
    
    // Get headers from first row
    console.log('\n📝 Column Headers:');
    const headers = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      const header = cell.text || cell.value || '';
      headers.push(header);
      console.log(`Column ${colNumber}: "${header}"`);
    });
    
    // Show first few data rows
    console.log('\n📊 Sample Data (first 3 rows):');
    for (let rowNum = 2; rowNum <= Math.min(4, worksheet.rowCount); rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData = [];
      
      console.log(`\nRow ${rowNum}:`);
      row.eachCell((cell, colNumber) => {
        const value = cell.text || cell.value || '';
        const header = headers[colNumber - 1] || `Col${colNumber}`;
        rowData.push(value);
        console.log(`  ${header}: "${value}"`);
      });
    }
    
    // Check for phone-related columns specifically
    console.log('\n🔍 Phone-related analysis:');
    const phoneColumns = headers.filter((header, index) => 
      header.toLowerCase().includes('phone') || 
      header.toLowerCase().includes('mobile') || 
      header.toLowerCase().includes('contact')
    );
    
    if (phoneColumns.length > 0) {
      console.log('✅ Found phone-related columns:', phoneColumns);
      
      // Check phone data in first few rows
      for (let rowNum = 2; rowNum <= Math.min(4, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        phoneColumns.forEach(phoneCol => {
          const colIndex = headers.indexOf(phoneCol) + 1;
          const phoneValue = row.getCell(colIndex).text || row.getCell(colIndex).value || '';
          console.log(`Row ${rowNum} ${phoneCol}: "${phoneValue}"`);
        });
      }
    } else {
      console.log('❌ No phone-related columns found');
      console.log('Available columns:', headers);
    }
    
  } catch (error) {
    console.log('❌ Error analyzing Excel file:', error.message);
  }
}

// Run the analysis
debugExcelStructure();
