#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDataIntegrity() {
  try {
    console.log('🔧 FIXING DATA INTEGRITY ISSUES\n');

    // Find member records that don't have valid member references
    console.log('=== 1. FINDING ORPHANED MEMBER RECORDS ===');
    
    const allMemberRecords = await prisma.groupMemberPeriodicRecord.findMany({
      include: {
        member: true
      }
    });

    console.log(`📊 Total member records: ${allMemberRecords.length}`);
    
    const orphanedRecords = allMemberRecords.filter(record => !record.member);
    console.log(`⚠️  Orphaned records (no member): ${orphanedRecords.length}`);
    
    if (orphanedRecords.length > 0) {
      console.log('\n🗑️  Deleting orphaned records...');
      
      for (const orphaned of orphanedRecords) {
        console.log(`   Deleting record: ${orphaned.id} (Member ID: ${orphaned.memberId})`);
        await prisma.groupMemberPeriodicRecord.delete({
          where: { id: orphaned.id }
        });
      }
      
      console.log(`✅ Deleted ${orphanedRecords.length} orphaned records`);
    }

    // Now test if the API call works
    console.log('\n=== 2. TESTING API CALL AFTER CLEANUP ===');
    
    const groupId = '68382afd6cad8afd7cf5bb1f';
    const records = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: groupId },
      orderBy: { meetingDate: 'desc' },
      take: 1
    });

    if (records.length === 0) {
      console.log('❌ No periodic records found');
      return;
    }

    const recordId = records[0].id;
    console.log(`📝 Testing Record: ${recordId}`);

    // Try the API call that was failing
    const apiResponse = await prisma.groupPeriodicRecord.findUnique({
      where: { id: recordId },
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

    if (!apiResponse) {
      console.log('❌ API call still failing');
      return;
    }

    console.log(`✅ API call successful!`);
    console.log(`   Member Records: ${apiResponse.memberRecords.length}`);

    // Check loan data in the API response
    console.log('\n=== 3. VERIFYING LOAN DATA IN API RESPONSE ===');
    
    let membersWithLoans = 0;
    apiResponse.memberRecords.forEach((mr, index) => {
      const member = mr.member;
      if (!member) {
        console.log(`   ${index + 1}. ERROR: No member data`);
        return;
      }
      
      const initialLoan = member.initialLoanAmount || 0;
      const currentBalance = member.loans?.reduce((sum, loan) => sum + loan.currentBalance, 0) || 0;
      
      if (initialLoan > 0 || currentBalance > 0) {
        membersWithLoans++;
        console.log(`   ${index + 1}. ${member.name}:`);
        console.log(`      Initial: ₹${initialLoan}, Current: ₹${currentBalance}`);
      }
    });

    console.log(`\n📊 Members with loan data: ${membersWithLoans}`);

    if (membersWithLoans > 0) {
      console.log('\n🎉 SUCCESS! Frontend should now display loan amounts correctly');
      console.log(`\n🌐 Test URL:`);
      console.log(`   http://localhost:3000/groups/${groupId}/periodic-records/${recordId}`);
    } else {
      console.log('\n⚠️  No loan data found in this periodic record');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error message:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixDataIntegrity();
