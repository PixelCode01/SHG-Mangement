#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOrphanedRecords() {
  try {
    console.log('🧹 CLEANING UP ORPHANED MEMBER RECORDS\n');

    // First, get all member records without trying to include member data
    console.log('=== 1. FINDING ALL MEMBER RECORDS ===');
    
    const allMemberRecords = await prisma.groupMemberPeriodicRecord.findMany({
      select: {
        id: true,
        memberId: true,
        groupPeriodicRecordId: true
      }
    });

    console.log(`📊 Total member records: ${allMemberRecords.length}`);

    // Check which member IDs actually exist
    console.log('\n=== 2. CHECKING MEMBER EXISTENCE ===');
    
    const allMemberIds = await prisma.member.findMany({
      select: { id: true }
    });
    
    const validMemberIds = new Set(allMemberIds.map(m => m.id));
    console.log(`✅ Valid members: ${validMemberIds.size}`);

    // Find orphaned records
    const orphanedRecords = allMemberRecords.filter(record => !validMemberIds.has(record.memberId));
    console.log(`⚠️  Orphaned member records: ${orphanedRecords.length}`);

    if (orphanedRecords.length > 0) {
      console.log('\n🗑️  Deleting orphaned records...');
      
      for (const orphaned of orphanedRecords) {
        console.log(`   Deleting: ${orphaned.id} (refers to non-existent member ${orphaned.memberId})`);
        await prisma.groupMemberPeriodicRecord.delete({
          where: { id: orphaned.id }
        });
      }
      
      console.log(`✅ Deleted ${orphanedRecords.length} orphaned records`);
    } else {
      console.log('✅ No orphaned records found');
    }

    // Now test the API call
    console.log('\n=== 3. TESTING FIXED API CALL ===');
    
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

    // Try the API call that was failing before
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
      console.log('❌ API call failed');
      return;
    }

    console.log(`✅ API call successful!`);
    console.log(`   Member Records: ${apiResponse.memberRecords.length}`);

    // Show loan data that should now be available
    console.log('\n=== 4. LOAN DATA AVAILABLE IN API ===');
    
    let membersWithLoans = 0;
    apiResponse.memberRecords.forEach((mr, index) => {
      const member = mr.member;
      const initialLoan = member.initialLoanAmount || 0;
      const currentBalance = member.loans?.reduce((sum, loan) => sum + loan.currentBalance, 0) || 0;
      
      if (initialLoan > 0 || currentBalance > 0) {
        membersWithLoans++;
        console.log(`   ${membersWithLoans}. ${member.name}:`);
        console.log(`      Initial Loan: ₹${initialLoan}`);
        console.log(`      Current Balance: ₹${currentBalance} (${member.loans?.length || 0} loans)`);
      }
    });

    if (membersWithLoans > 0) {
      console.log(`\n🎉 SUCCESS! Found ${membersWithLoans} members with loan data`);
      console.log('\n🌐 Frontend should now display loan amounts correctly at:');
      console.log(`   http://localhost:3000/groups/${groupId}/periodic-records/${recordId}`);
      
      console.log('\n📋 Expected behavior:');
      console.log('   - Loan Amount column should show current loan balances');
      console.log('   - Members with active loans should show non-zero amounts');
      console.log('   - All values should be properly formatted with ₹ symbol');
    } else {
      console.log('\n⚠️  No members with loan data found in this periodic record');
      console.log('   This might be expected if this record predates the loan data');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error message:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedRecords();
