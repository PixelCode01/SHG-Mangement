const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create a new PDF document
const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('sample-members.pdf'));

// Add document title
doc.fontSize(18).text('Member List for Import', { align: 'center' });
doc.moveDown();

// Add table headers with some styling
doc.fontSize(12).fillColor('blue');
doc.text('Name                    Loan Amount        Email                      Phone', { align: 'left' });

// Add a line under headers
doc.moveTo(50, doc.y)
   .lineTo(550, doc.y)
   .stroke();
doc.moveDown(0.5);

// Reset text color for table content
doc.fillColor('black');

// Add member data
const members = [
  { name: 'John Doe', loanAmount: '5000', email: 'john.doe@example.com', phone: '+1234567890' },
  { name: 'Jane Smith', loanAmount: '7500', email: 'jane.smith@example.com', phone: '+1234567891' },
  { name: 'Bob Johnson', loanAmount: '10000', email: '', phone: '+1234567892' },
  { name: 'Alice Brown', loanAmount: '3000', email: 'alice.brown@example.com', phone: '' },
  { name: 'Charlie Wilson', loanAmount: '8500', email: 'charlie.wilson@example.com', phone: '+1234567894' },
  { name: 'Leader Example', loanAmount: '12000', email: 'leader@example.com', phone: '+1234567895' },
];

// Add each member as a row in the table
members.forEach(member => {
  const nameField = member.name.padEnd(22, ' ');
  const loanField = member.loanAmount.padEnd(18, ' ');
  const emailField = member.email.padEnd(26, ' ');
  const phoneField = member.phone;
  
  doc.text(`${nameField}${loanField}${emailField}${phoneField}`);
  doc.moveDown(0.5);
});

// Add a note
doc.moveDown();
doc.fontSize(10).text('This PDF contains sample member data for importing into the SHG Management system.', { align: 'center', italic: true });

// Finalize the PDF
doc.end();

console.log('Sample PDF file created: sample-members.pdf');
