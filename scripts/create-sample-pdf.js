const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create a sample PDF with member data in a table format
const generateSamplePDF = () => {
  // Create a document
  const doc = new PDFDocument({ margin: 50 });

  // Save the PDF to a file in the public directory
  const writeStream = fs.createWriteStream('./public/sample-members.pdf');
  doc.pipe(writeStream);

  // Add heading
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .text('SHG Member Details', { align: 'center' });
  doc.moveDown();

  // Add group details
  doc.fontSize(12)
     .font('Helvetica')
     .text('Group Name: Samriddhi Self Help Group', { align: 'left' });
  doc.text('Date: ' + new Date().toLocaleDateString(), { align: 'left' });
  doc.moveDown(2);

  // Define sample member data
  const members = [
    { id: 1, name: 'John Doe', loanAmount: 5000, email: 'john.doe@example.com', phone: '+1234567890' },
    { id: 2, name: 'Jane Smith', loanAmount: 7500, email: 'jane.smith@example.com', phone: '+1234567891' },
    { id: 3, name: 'Robert Johnson', loanAmount: 6000, email: 'robert.j@example.com', phone: '+1234567892' },
    { id: 4, name: 'Mary Williams', loanAmount: 8000, email: 'mary.w@example.com', phone: '+1234567893' },
    { id: 5, name: 'David Brown', loanAmount: 10000, email: 'david.b@example.com', phone: '+1234567894' },
    { id: 6, name: 'Linda Davis', loanAmount: 4000, email: '', phone: '+1234567895' },
    { id: 7, name: 'Richard Wilson', loanAmount: 7000, email: 'richard.w@example.com', phone: '' },
    { id: 8, name: 'Susan Miller', loanAmount: 9000, email: '', phone: '' },
    { id: 9, name: 'Michael Moore', loanAmount: 6500, email: 'michael.m@example.com', phone: '+1234567899' },
    { id: 10, name: 'Patricia Taylor', loanAmount: 8500, email: 'patricia.t@example.com', phone: '+1234567800' },
  ];

  // Define table layout
  const tableTop = 150;
  const columnSpacing = 15;
  const idColWidth = 30;
  const nameColWidth = 120;
  const loanColWidth = 90;
  const emailColWidth = 180;
  const phoneColWidth = 100;
  
  // Draw table headers
  doc.font('Helvetica-Bold')
     .fontSize(10);

  // Header row - titles
  doc.text('ID', 50, tableTop)
     .text('Name', 50 + idColWidth + columnSpacing, tableTop)
     .text('Loan Amount', 50 + idColWidth + columnSpacing + nameColWidth + columnSpacing, tableTop)
     .text('Email', 50 + idColWidth + columnSpacing + nameColWidth + columnSpacing + loanColWidth + columnSpacing, tableTop)
     .text('Phone', 50 + idColWidth + columnSpacing + nameColWidth + columnSpacing + loanColWidth + columnSpacing + emailColWidth + columnSpacing, tableTop);

  // Divider line
  doc.moveTo(50, tableTop + 15)
     .lineTo(50 + idColWidth + columnSpacing + nameColWidth + columnSpacing + loanColWidth + columnSpacing + emailColWidth + columnSpacing + phoneColWidth, tableTop + 15)
     .stroke();

  // Draw rows
  doc.font('Helvetica').fontSize(10);
  
  let rowTop = tableTop + 25;
  const lineHeight = 20;
  
  members.forEach((member) => {
    doc.text(member.id.toString(), 50, rowTop)
       .text(member.name, 50 + idColWidth + columnSpacing, rowTop)
       .text(`Rs. ${member.loanAmount}`, 50 + idColWidth + columnSpacing + nameColWidth + columnSpacing, rowTop)
       .text(member.email, 50 + idColWidth + columnSpacing + nameColWidth + columnSpacing + loanColWidth + columnSpacing, rowTop)
       .text(member.phone, 50 + idColWidth + columnSpacing + nameColWidth + columnSpacing + loanColWidth + columnSpacing + emailColWidth + columnSpacing, rowTop);
    
    rowTop += lineHeight;
  });

  // Draw table bottom line
  doc.moveTo(50, rowTop)
     .lineTo(50 + idColWidth + columnSpacing + nameColWidth + columnSpacing + loanColWidth + columnSpacing + emailColWidth + columnSpacing + phoneColWidth, rowTop)
     .stroke();

  // Add footer
  doc.fontSize(10)
     .text('Generated for testing purposes', 50, rowTop + 30, { align: 'center' });

  // Finalize PDF file
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log('PDF created successfully at ./public/sample-members.pdf');
      resolve('./public/sample-members.pdf');
    });
    writeStream.on('error', (err) => {
      console.error('Error writing PDF:', err);
      reject(err);
    });
  });
};

// Alternative table style - Format 2
const generateAlternateFormatPDF = () => {
  const doc = new PDFDocument({ margin: 50 });
  const writeStream = fs.createWriteStream('./public/sample-members-alt.pdf');
  doc.pipe(writeStream);

  // Add heading
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text('MEMBER REGISTRY - FINANCIAL YEAR 2025', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12)
     .text('Grameen Seva Self Help Group', { align: 'center' });
  doc.moveDown(2);

  // Define sample member data
  const members = [
    { sl: 1, name: 'RAJESH KUMAR', amount: 4800 },
    { sl: 2, name: 'SANTOSH MISHRA', amount: 5200 },
    { sl: 3, name: 'PRIYA SHARMA', amount: 7500 },
    { sl: 4, name: 'ANITA DEVI', amount: 6300 },
    { sl: 5, name: 'MOHAN SINGH', amount: 9000 },
    { sl: 6, name: 'KAVITA KUMARI', amount: 4200 },
    { sl: 7, name: 'SANJAY YADAV', amount: 8500 },
    { sl: 8, name: 'MEENA GUPTA', amount: 7200 },
    { sl: 9, name: 'RAKESH PATEL', amount: 6800 },
    { sl: 10, name: 'SUNITA DEVI', amount: 5500 },
  ];

  // Add a simple table without clear grid lines
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('SL', 50, 150);
  doc.text('MEMBER NAME', 100, 150);
  doc.text('AMOUNT (Rs.)', 300, 150);
  
  doc.moveTo(50, 165).lineTo(400, 165).stroke();
  
  // Data rows
  let y = 180;
  doc.font('Helvetica').fontSize(11);
  
  members.forEach(member => {
    doc.text(member.sl.toString(), 50, y);
    doc.text(member.name, 100, y);
    doc.text(member.amount.toString(), 300, y);
    y += 25;
  });
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log('Alternate format PDF created at ./public/sample-members-alt.pdf');
      resolve('./public/sample-members-alt.pdf');
    });
    writeStream.on('error', reject);
  });
};

// Create both sample PDFs
Promise.all([
  generateSamplePDF(),
  generateAlternateFormatPDF()
]).then(() => {
  console.log('All sample PDFs have been created successfully.');
}).catch(err => {
  console.error('Error generating PDFs:', err);
});
