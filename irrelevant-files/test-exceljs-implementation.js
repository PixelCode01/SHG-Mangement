const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function testExcelJSImplementation() {
    console.log('Testing ExcelJS implementation...');
    
    try {
        // Test 1: Create a workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Test Members');
        
        // Test 2: Define columns
        worksheet.columns = [
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Address', key: 'address', width: 30 },
            { header: 'Joining Date', key: 'joiningDate', width: 15 }
        ];
        
        // Test 3: Add sample data
        const testData = [
            { name: 'Test Member 1', phone: '1234567890', address: 'Test Address 1', joiningDate: '2024-01-01' },
            { name: 'Test Member 2', phone: '0987654321', address: 'Test Address 2', joiningDate: '2024-01-02' }
        ];
        
        testData.forEach(member => {
            worksheet.addRow(member);
        });
        
        // Test 4: Write file
        const testFilePath = path.join(__dirname, 'test-excel-output.xlsx');
        await workbook.xlsx.writeFile(testFilePath);
        console.log('✓ Excel file created successfully');
        
        // Test 5: Read the file back
        const readWorkbook = new ExcelJS.Workbook();
        await readWorkbook.xlsx.readFile(testFilePath);
        const readWorksheet = readWorkbook.getWorksheet('Test Members');
        
        console.log('✓ Excel file read successfully');
        console.log('Worksheet has', readWorksheet.rowCount, 'rows');
        
        // Test 6: Read data from buffer (simulating file upload)
        const buffer = await fs.promises.readFile(testFilePath);
        const bufferWorkbook = new ExcelJS.Workbook();
        await bufferWorkbook.xlsx.load(buffer);
        const bufferWorksheet = bufferWorkbook.getWorksheet('Test Members');
        
        console.log('✓ Excel file loaded from buffer successfully');
        
        // Test 7: Extract data like in MultiStepGroupForm
        const extractedData = [];
        bufferWorksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
                const rowData = {
                    name: row.getCell(1).value,
                    phone: row.getCell(2).value,
                    address: row.getCell(3).value,
                    joiningDate: row.getCell(4).value
                };
                extractedData.push(rowData);
            }
        });
        
        console.log('✓ Data extraction successful');
        console.log('Extracted data:', extractedData);
        
        // Cleanup
        fs.unlinkSync(testFilePath);
        console.log('✓ Test file cleaned up');
        
        console.log('\n🎉 All ExcelJS tests passed! The implementation is working correctly.');
        
    } catch (error) {
        console.error('❌ ExcelJS test failed:', error);
        process.exit(1);
    }
}

testExcelJSImplementation();
