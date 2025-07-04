const ExcelJS = require('exceljs');
const path = require('path');

async function debugMembersExcel() {
    const filePath = '/home/pixel/Downloads/members (1).xlsx';
    
    try {
        console.log('🔍 Loading Excel file:', filePath);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        console.log('\n📊 Workbook Analysis:');
        console.log('  Number of worksheets:', workbook.worksheets.length);
        console.log('  Worksheet names:', workbook.worksheets.map(ws => ws.name));
        
        const worksheet = workbook.worksheets[0];
        console.log('\n📋 First worksheet details:');
        console.log('  Name:', worksheet.name);
        console.log('  Row count:', worksheet.rowCount);
        console.log('  Column count:', worksheet.columnCount);
        
        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            headers.push({
                column: colNumber,
                value: cell.value,
                text: cell.text
            });
        });
        
        console.log('\n📄 Headers found:');
        headers.forEach((header, index) => {
            console.log(`  Column ${header.column}: "${header.value}" (text: "${header.text}")`);
        });
        
        // Check for expected column names (case-insensitive)
        const expectedColumns = ['name', 'loan amount', 'email', 'phone'];
        const foundColumns = {};
        
        headers.forEach(header => {
            const headerText = (header.text || '').toLowerCase().trim();
            expectedColumns.forEach(expected => {
                if (headerText.includes(expected) || headerText === expected) {
                    foundColumns[expected] = header.column;
                }
            });
        });
        
        console.log('\n🎯 Expected column mapping:');
        expectedColumns.forEach(col => {
            if (foundColumns[col]) {
                console.log(`  ✅ ${col}: Found in column ${foundColumns[col]}`);
            } else {
                console.log(`  ❌ ${col}: Not found`);
            }
        });
        
        // Process data rows like the actual code does
        console.log('\n🔄 Processing data rows:');
        const jsonData = [];
        let rowsProcessed = 0;
        
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
                const rowData = {};
                let hasData = false;
                
                row.eachCell((cell, colNumber) => {
                    const header = headers.find(h => h.column === colNumber);
                    if (header && header.text) {
                        rowData[header.text] = cell.text;
                        if (cell.text && cell.text.trim()) {
                            hasData = true;
                        }
                    }
                });
                
                if (hasData && (rowData.Name || rowData.name || rowData.NAME)) {
                    jsonData.push(rowData);
                    rowsProcessed++;
                    
                    // Show first 3 rows for debugging
                    if (rowsProcessed <= 3) {
                        console.log(`  Row ${rowNumber}:`, JSON.stringify(rowData, null, 4));
                    }
                }
            }
        });
        
        console.log(`\n📈 Summary:`);
        console.log(`  Total data rows processed: ${jsonData.length}`);
        console.log(`  Rows with names: ${jsonData.filter(row => row.Name || row.name || row.NAME).length}`);
        
        if (jsonData.length > 0) {
            console.log('\n🎉 Sample processed members:');
            jsonData.slice(0, 5).forEach((row, index) => {
                const name = (row['Name'] || row['name'] || row['NAME'] || '').trim();
                const loanAmount = (row['Loan Amount'] || row['loan amount'] || row['LOAN'] || row['Loan'] || '0').replace(/,/g, '').trim();
                const email = (row['Email'] || row['email'] || row['EMAIL'] || '').trim();
                const phone = (row['Phone'] || row['phone'] || row['PHONE'] || '').trim();
                
                console.log(`  ${index + 1}. Name: "${name}"`);
                console.log(`      Loan: "${loanAmount}"`);
                console.log(`      Email: "${email}"`);
                console.log(`      Phone: "${phone}"`);
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('❌ Error reading Excel file:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
    }
}

console.log('🧪 DEBUGGING MEMBERS EXCEL FILE');
console.log('=====================================');
debugMembersExcel();
