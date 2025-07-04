const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPeriodicRecords() {
  console.log('=== CHECKING PERIODIC RECORDS ===');

  try {
    // Find all periodic records
    const periodicRecords = await prisma.groupPeriodicRecord.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        group: {
          select: {
            id: true,
            name: true
          }
        },
        memberRecords: {
          include: {
            member: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    console.log(`\nFound ${periodicRecords.length} periodic records:`);
    
    for (const record of periodicRecords) {
      console.log(`\nPeriodic Record ID: ${record.id}`);
      console.log(`Group: ${record.group.name} (${record.group.id})`);
      console.log(`Period: ${record.year}-${String(record.month).padStart(2, '0')}`);
      console.log(`Created: ${record.createdAt}`);
      console.log(`Status: ${record.status}`);
      console.log(`Total Collection: ${record.totalCollection}`);
      console.log(`Cash Balance: ${record.cashBalance}`);
      console.log(`Total Loan Balance: ${record.totalLoanBalance}`);
      console.log(`Member Records: ${record.memberRecords.length}`);
      
      // Check for duplicates
      const duplicates = periodicRecords.filter(pr => 
        pr.id !== record.id && 
        pr.group.id === record.group.id && 
        pr.year === record.year && 
        pr.month === record.month
      );
      
      if (duplicates.length > 0) {
        console.log(`🚨 DUPLICATE FOUND! This record has ${duplicates.length} duplicate(s):`);
        duplicates.forEach(dup => {
          console.log(`  - ID: ${dup.id}, Created: ${dup.createdAt}`);
        });
      }
    }

    // Check specifically for June 2025 records
    console.log('\n=== JUNE 2025 RECORDS ===');
    const june2025Records = periodicRecords.filter(record => 
      record.year === 2025 && record.month === 6
    );

    if (june2025Records.length > 0) {
      console.log(`Found ${june2025Records.length} June 2025 records:`);
      june2025Records.forEach((record, index) => {
        console.log(`\n${index + 1}. Record ID: ${record.id}`);
        console.log(`   Group: ${record.group.name}`);
        console.log(`   Created: ${record.createdAt}`);
        console.log(`   Status: ${record.status}`);
        console.log(`   Total Collection: ${record.totalCollection}`);
        console.log(`   Cash Balance: ${record.cashBalance}`);
        console.log(`   Total Loan Balance: ${record.totalLoanBalance}`);
        console.log(`   Member Records: ${record.memberRecords.length}`);
      });
    } else {
      console.log('No June 2025 records found.');
    }

  } catch (error) {
    console.error('Error checking periodic records:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPeriodicRecords();
