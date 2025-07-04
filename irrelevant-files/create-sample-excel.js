const ExcelJS = require('exceljs');

// Sample data
const data = [
  { Name: 'John Doe', 'Loan Amount': 5000, Email: 'john.doe@example.com', Phone: '+1234567890' },
  { Name: 'Jane Smith', 'Loan Amount': 7500, Email: 'jane.smith@example.com', Phone: '+1234567891' },
  { Name: 'Bob Johnson', 'Loan Amount': 10000, Email: '', Phone: '+1234567892' },
  { Name: 'Alice Brown', 'Loan Amount': 3000, Email: 'alice.brown@example.com', Phone: '' },
  { Name: 'Charlie Wilson', 'Loan Amount': 8500, Email: 'charlie.wilson@example.com', Phone: '+1234567894' },
  { Name: 'Leader Example', 'Loan Amount': 12000, Email: 'leader@example.com', Phone: '+1234567895' }
];

// Create workbook and worksheet
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Members');

// Set column headers
worksheet.columns = [
  { header: 'Name', key: 'Name', width: 20 },
  { header: 'Loan Amount', key: 'Loan Amount', width: 15 },
  { header: 'Email', key: 'Email', width: 25 },
  { header: 'Phone', key: 'Phone', width: 15 }
];

// Add data rows
data.forEach(row => {
  worksheet.addRow(row);
});

// Write file
workbook.xlsx.writeFile('sample-members.xlsx').then(() => {
  console.log('Sample Excel file created: sample-members.xlsx');
});
