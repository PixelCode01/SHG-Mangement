const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create a sample PDF with irregular spacing between names and amounts
const generateIrregularSpacingPDF = () => {
  // Create a document
  const doc = new PDFDocument({ margin: 50 });

  // Save the PDF to a file in the public directory
  const writeStream = fs.createWriteStream('./public/sample-members-irregular.pdf');
  doc.pipe(writeStream);

  // Add heading
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text('MEMBER LOAN REGISTRY', { align: 'center' });
  doc.moveDown();

  // Add group details
  doc.fontSize(12)
     .font('Helvetica')
     .text('Samriddhi Mahila Self Help Group', { align: 'center' });
  doc.moveDown(2);

  // Define the header with large spacing
  doc.font('Helvetica-Bold')
     .fontSize(12);
  
  doc.text('NAME                                   LOAN', {
    align: 'left'
  });
  
  // Add a line under the header
  doc.moveTo(50, 150)
     .lineTo(550, 150)
     .stroke();
  
  // Define sample data with irregular spacing
  const memberData = [
    { name: 'SANTOSH MISHRA', amount: '89000' },
    { name: 'ASHOK KUMAR KESHRI', amount: '9999' },
    { name: 'MEENA KUMARI', amount: '78500' },
    { name: 'RAJESH SINGH', amount: '125000' },
    { name: 'PRIYA SHARMA', amount: '45600' },
    { name: 'GOPAL DAS', amount: '88000' },
    { name: 'SHANTI DEVI', amount: '67500' },
    { name: 'MOHAN LAL', amount: '99000' },
    { name: 'KAVITA GUPTA', amount: '105000' },
    { name: 'RAMESH PATEL', amount: '76000' }
  ];
  
  // Print the data with irregular spacing
  doc.font('Helvetica').fontSize(11);
  
  let y = 170;
  
  memberData.forEach(member => {
    // Calculate a space that places the loan amount roughly where it should be
    const nameLength = member.name.length;
    const baseSpaces = 30; // Base number of spaces
    const spaceAdjustment = Math.max(0, Math.min(15, 15 - (nameLength - 10))); // Adjust spaces based on name length
    const totalSpaces = baseSpaces - nameLength + spaceAdjustment;
    
    // Create a string with the exact spacing
    let spacedText = member.name;
    for (let i = 0; i < totalSpaces; i++) {
      spacedText += ' ';
    }
    spacedText += member.amount;
    
    doc.text(spacedText, 50, y);
    y += 25;
  });
  
  // Add footer
  doc.fontSize(10)
     .text('Generated for testing irregular spacing parser', 50, y + 30, { align: 'center' });

  // Finalize PDF file
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log('Irregular spacing PDF created at ./public/sample-members-irregular.pdf');
      resolve('./public/sample-members-irregular.pdf');
    });
    writeStream.on('error', reject);
  });
};

// Create the irregular spacing format PDF
generateIrregularSpacingPDF()
  .then(() => {
    console.log('Irregular spacing sample PDF has been created successfully.');
  })
  .catch(err => {
    console.error('Error generating irregular spacing PDF:', err);
  });
