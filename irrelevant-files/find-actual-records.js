#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findActualRecords() {
  try {
    console.log('🔍 FINDING ACTUAL PERIODIC RECORDS\n');

    // First, let's find all groups
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true
      }
    });

    console.log(`📊 Found ${groups.length} groups:`);
    groups.forEach((group, index) => {
      console.log(`   ${index + 1}. ${group.name} (${group.id})`);
    });

    if (groups.length === 0) {
      console.log('❌ No groups found');
      return;
    }

    // Check for periodic records in each group
    console.log('\n=== CHECKING PERIODIC RECORDS ===');
    
    for (const group of groups) {
      const records = await prisma.groupPeriodicRecord.findMany({
        where: { groupId: group.id },
        select: {
          id: true,
          meetingDate: true,
          recordSequenceNumber: true
        },
        orderBy: { meetingDate: 'desc' },
        take: 3
      });

      console.log(`\n🏢 Group: ${group.name}`);
      console.log(`   Records: ${records.length}`);
      
      if (records.length > 0) {
        records.forEach((record, index) => {
          console.log(`     ${index + 1}. ID: ${record.id}`);
          console.log(`        Date: ${record.meetingDate.toLocaleDateString()}`);
          console.log(`        Sequence: ${record.recordSequenceNumber}`);
        });
        
        // Use the first record to test
        const testRecord = records[0];
        console.log(`\n🎯 TEST URLs for Group: ${group.name}`);
        console.log(`   View: http://localhost:3000/groups/${group.id}/periodic-records/${testRecord.id}`);
        
        // Now check if this record has members with loan data
        const recordWithMembers = await prisma.groupPeriodicRecord.findUnique({
          where: { id: testRecord.id },
          include: {
            memberRecords: {
              include: {
                member: {
                  include: {
                    loans: {
                      where: { status: 'ACTIVE' }
                    }
                  }
                }
              }
            }
          }
        });

        if (recordWithMembers) {
          console.log(`   Members in Record: ${recordWithMembers.memberRecords.length}`);
          
          let hasLoanData = false;
          recordWithMembers.memberRecords.forEach((mr, mrIndex) => {
            const initialLoan = mr.member?.initialLoanAmount || 0;
            const activeLoans = mr.member?.loans?.length || 0;
            const currentBalance = mr.member?.loans?.reduce((sum, loan) => sum + loan.currentBalance, 0) || 0;
            
            if (initialLoan > 0 || activeLoans > 0) {
              hasLoanData = true;
              console.log(`     ${mrIndex + 1}. ${mr.member?.name}: Initial ₹${initialLoan}, Current ₹${currentBalance} (${activeLoans} loans)`);
            }
          });
          
          if (!hasLoanData) {
            console.log(`     ⚠️  No members have loan data in this record`);
          }
        }
      } else {
        console.log(`     ⚠️  No periodic records found`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findActualRecords();
