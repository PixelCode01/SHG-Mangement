const ExcelJS = require('exceljs');
const path = require('path');

async function testUpdatedExcelParsing() {
    const filePath = '/home/pixel/Downloads/members (1).xlsx';
    
    try {
        console.log('🔍 Testing updated Excel parsing logic...');
        console.log('File:', filePath);
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);
        const jsonData = [];
        
        if (worksheet) {
          const headers = [];
          // Get headers from first row
          worksheet.getRow(1).eachCell((cell, colNumber) => {
            headers[colNumber - 1] = cell.text;
          });
          
          console.log('📄 Headers:', headers);
          
          // Process data rows (simulating the updated logic)
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
              const rowData = {};
              row.eachCell((cell, colNumber) => {
                const header = headers[colNumber - 1];
                if (header) {
                  rowData[header] = cell.text;
                }
              });
              
              // Updated condition to include NAME
              if (rowData.Name || rowData.name || rowData.NAME) {
                jsonData.push(rowData);
              }
            }
          });
        }
        
        console.log(`\n✅ Successfully parsed ${jsonData.length} rows`);
        
        if (jsonData.length > 0) {
            console.log('\n🧪 Testing field mapping with updated logic:');
            
            // Test the updated field mapping logic
            const validMembers = [];
            
            jsonData.forEach((row, index) => {
                // Updated field mapping logic
                const name = (row['Name'] || row['name'] || row['NAME'] || '').trim();
                const loanAmountStrRaw = row['Loan Amount'] || row['loan amount'] || row['LOAN'] || row['Loan'] || '';
                const loanAmountStr = loanAmountStrRaw.replace(/,/g, '').trim();
                const email = (row['Email'] || row['email'] || row['EMAIL'] || '').trim();
                const phone = (row['Phone'] || row['phone'] || row['Phone Number'] || row['phone number'] || row['PHONE'] || '').trim();
                
                console.log(`\nRow ${index + 1}:`);
                console.log(`  Raw data:`, JSON.stringify(row, null, 2));
                console.log(`  Extracted name: "${name}"`);
                console.log(`  Extracted loan amount: "${loanAmountStr}"`);
                console.log(`  Extracted email: "${email}"`);
                console.log(`  Extracted phone: "${phone}"`);
                
                if (name.trim()) {
                    let loanAmount = 0;
                    if (loanAmountStr) {
                        const parsed = parseFloat(loanAmountStr);
                        if (!isNaN(parsed) && parsed >= 0) {
                            loanAmount = parsed;
                        }
                    }
                    
                    const memberObj = {
                        name: name.trim(),
                        loanAmount,
                    };
                    
                    if (email) memberObj.email = email;
                    if (phone) memberObj.phone = phone;
                    
                    validMembers.push(memberObj);
                    console.log(`  ✅ Valid member created:`, memberObj);
                } else {
                    console.log(`  ❌ No valid name found`);
                }
            });
            
            console.log(`\n🎉 Total valid members: ${validMembers.length}`);
            
            if (validMembers.length > 0) {
                console.log('\n📋 Summary of all valid members:');
                validMembers.forEach((member, index) => {
                    console.log(`  ${index + 1}. ${member.name} - ₹${member.loanAmount}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing Excel parsing:', error);
    }
}

console.log('🧪 TESTING UPDATED EXCEL PARSING LOGIC');
console.log('========================================');
testUpdatedExcelParsing();
