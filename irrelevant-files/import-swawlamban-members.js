const fs = require('fs');

async function importSwawlambanMembers() {
  try {
    console.log('🚀 Starting SWAWLAMBAN member import...');
    
    // Read the formatted import data
    const importData = JSON.parse(fs.readFileSync('./swawlamban-import-ready.json', 'utf8'));
    console.log(`📊 Found ${importData.members.length} members to import`);
    
    // Try to import via API
    console.log('🌐 Attempting API import...');
    
    const response = await fetch('http://localhost:3001/api/members/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(importData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Import successful!');
      console.log(`📈 Imported ${result.count} members`);
    } else {
      const error = await response.text();
      console.log('❌ API import failed:', response.status);
      console.log('Error:', error);
      
      // Fallback: Direct database import
      console.log('\n🔄 Falling back to direct database import...');
      await directDatabaseImport(importData.members);
    }
    
  } catch (error) {
    console.log('❌ API not available, using direct database import...');
    console.log('Error:', error.message);
    
    // Read the data again for direct import
    const importData = JSON.parse(fs.readFileSync('./swawlamban-import-ready.json', 'utf8'));
    await directDatabaseImport(importData.members);
  }
}

async function directDatabaseImport(members) {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    console.log('💾 Connecting to database...');
    
    // Prepare data for Prisma
    const membersToCreate = members.map(member => ({
      name: member.Name,
      email: member.Email || null,
      phone: member.Phone || null,
      address: member.Address || null,
      initialLoanAmount: member.LoanAmount || null,
    }));
    
    console.log('📝 Inserting members into database...');
    
    // Import members one by one to handle potential duplicates
    let successCount = 0;
    let errorCount = 0;
    
    for (const memberData of membersToCreate) {
      try {
        await prisma.member.create({
          data: memberData
        });
        successCount++;
        console.log(`✅ Added: ${memberData.name}`);
      } catch (error) {
        errorCount++;
        console.log(`❌ Failed to add: ${memberData.name} - ${error.message}`);
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully imported: ${successCount} members`);
    console.log(`❌ Failed to import: ${errorCount} members`);
    console.log(`📈 Total processed: ${successCount + errorCount} members`);
    
    await prisma.$disconnect();
    console.log('🔚 Database connection closed');
    
  } catch (error) {
    console.log('❌ Database import failed:', error.message);
    console.log('\n📋 You can manually import using the web interface:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Open http://localhost:3001/members');
    console.log('3. Look for import functionality');
    console.log('4. Upload swawlamban-import-ready.json');
  }
}

// Run the import
importSwawlambanMembers().catch(console.error);
