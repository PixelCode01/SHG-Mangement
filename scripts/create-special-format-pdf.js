const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create a sample PDF with the special format where names and loan amounts are on different lines
const generateSpecialFormatPDF = () => {
  // Create a document
  const doc = new PDFDocument({ margin: 50 });

  // Save the PDF to a file in the public directory
  const writeStream = fs.createWriteStream('./public/sample-members-special.pdf');
  doc.pipe(writeStream);

  // Add heading
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text('MEMBER DETAILS REPORT', { align: 'center' });
  doc.moveDown();

  // Add group details
  doc.fontSize(12)
     .font('Helvetica')
     .text('Gramin Vikas Self Help Group', { align: 'center' });
  doc.text('Year 2024-2025', { align: 'center' });
  doc.moveDown(2);

  // Define the special format headers with spacing
  doc.font('Helvetica-Bold')
     .fontSize(12);
  
  doc.text('NAME                                                LOAN', {
    align: 'left'
  });
  
  doc.moveTo(50, 150)
     .lineTo(550, 150)
     .stroke();
  
  // Define sample data
  const loanAmounts = [
    '178604',
    '0',
    '2470000',
    '0',
    '184168',
    '125000',
    '95400',
    '75000',
    '250000',
    '0'
  ];
  
  const memberNames = [
    'SANTOSH MISHRA',
    'ASHOK KUMAR KESHRI',
    'RAMESH SINGH',
    'VIJAY KUMAR',
    'PRADEEP GUPTA',
    'SUNITA DEVI',
    'ANIL SHARMA',
    'MEENA KUMARI',
    'RAKESH PATEL',
    'KAVITA YADAV'
  ];
  
  // Print the data in the special format
  doc.font('Helvetica').fontSize(11);
  
  let y = 170;
  
  // First print all the loan amounts
  loanAmounts.forEach(amount => {
    doc.text(amount, 400, y);
    y += 25;
  });
  
  // Reset y position and print all the names
  y = 170;
  memberNames.forEach(name => {
    doc.text(name, 50, y);
    y += 25;
  });
  
  // Add footer
  doc.fontSize(10)
     .text('Generated for testing the special format parser', 50, y + 30, { align: 'center' });

  // Finalize PDF file
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log('Special format PDF created at ./public/sample-members-special.pdf');
      resolve('./public/sample-members-special.pdf');
    });
    writeStream.on('error', reject);
  });
};

// Create the special format PDF
generateSpecialFormatPDF()
  .then(() => {
    console.log('Special format sample PDF has been created successfully.');
  })
  .catch(err => {
    console.error('Error generating special format PDF:', err);
  });
