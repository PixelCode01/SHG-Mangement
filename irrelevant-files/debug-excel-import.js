const ExcelJS = require('exceljs');
const path = require('path');

async function debugExcelFile() {
    const filePath = '/home/pixel/Downloads/loan_data_no_dashes.xlsx';
    
    try {
        console.log('Loading Excel file:', filePath);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        console.log('\nWorkbook sheets:', workbook.worksheets.map(ws => ws.name));
        
        const worksheet = workbook.worksheets[0];
        console.log('\nFirst worksheet name:', worksheet.name);
        console.log('Row count:', worksheet.rowCount);
        console.log('Column count:', worksheet.columnCount);
        
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
        
        console.log('\nHeaders found:');
        headers.forEach((header, index) => {
            console.log(`Column ${header.column}: "${header.value}" (text: "${header.text}")`);
        });
        
        // Check first few data rows
        console.log('\nFirst 3 data rows:');
        for (let rowNum = 2; rowNum <= Math.min(4, worksheet.rowCount); rowNum++) {
            const row = worksheet.getRow(rowNum);
            const rowData = {};
            
            row.eachCell((cell, colNumber) => {
                const header = headers.find(h => h.column === colNumber);
                if (header) {
                    rowData[header.text] = {
                        value: cell.value,
                        text: cell.text,
                        type: cell.type
                    };
                }
            });
            
            console.log(`\nRow ${rowNum}:`, JSON.stringify(rowData, null, 2));
        }
        
        // Look specifically for phone-related columns
        console.log('\nPhone-related columns:');
        headers.forEach(header => {
            const headerText = header.text?.toLowerCase() || '';
            if (headerText.includes('phone') || headerText.includes('mobile') || headerText.includes('contact')) {
                console.log(`Found potential phone column: "${header.text}" at column ${header.column}`);
            }
        });
        
    } catch (error) {
        console.error('Error reading Excel file:', error);
    }
}

debugExcelFile();
