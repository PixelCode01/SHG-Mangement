#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestRecordWithLoans() {
  try {
    console.log('🏗️  CREATING TEST PERIODIC RECORD WITH LOAN DATA\n');

    const groupId = '68382afd6cad8afd7cf5bb1f'; // 'bb' group

    // Get members with loan data
    console.log('=== 1. FINDING MEMBERS WITH LOAN DATA ===');
    
    const membersWithLoans = await prisma.member.findMany({
      where: {
        OR: [
          { initialLoanAmount: { gt: 0 } },
          { loans: { some: { status: 'ACTIVE' } } }
        ]
      },
      include: {
        loans: {
          where: { status: 'ACTIVE' }
        },
        memberships: {
          where: { groupId: groupId }
        }
      }
    });

    console.log(`📊 Members with loan data: ${membersWithLoans.length}`);
    
    // Filter to only members in our test group
    const groupMembersWithLoans = membersWithLoans.filter(member => 
      member.memberships.length > 0
    );

    console.log(`📊 Group members with loan data: ${groupMembersWithLoans.length}`);
    
    if (groupMembersWithLoans.length === 0) {
      console.log('❌ No group members have loan data');
      return;
    }

    groupMembersWithLoans.forEach((member, index) => {
      const currentBalance = member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      console.log(`   ${index + 1}. ${member.name}:`);
      console.log(`      Initial: ₹${member.initialLoanAmount || 0}`);
      console.log(`      Current: ₹${currentBalance} (${member.loans.length} loans)`);
    });

    // Create a new periodic record for testing
    console.log('\n=== 2. CREATING NEW PERIODIC RECORD ===');
    
    const periodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: groupId,
        meetingDate: new Date(),
        recordSequenceNumber: 999, // High number to identify as test
        standingAtStartOfPeriod: 100000,
        totalCollectionThisPeriod: 15000,
        expensesThisPeriod: 2000,
        totalGroupStandingAtEndOfPeriod: 113000,
        cashInHandAtEndOfPeriod: 113000,
        cashInBankAtEndOfPeriod: 0,
        newContributionsThisPeriod: 15000,
        interestEarnedThisPeriod: 0,
        loanProcessingFeesCollectedThisPeriod: 0,
        lateFinesCollectedThisPeriod: 0
      }
    });

    console.log(`✅ Created periodic record: ${periodicRecord.id}`);

    // Create member records for the first few members with loan data
    console.log('\n=== 3. CREATING MEMBER RECORDS ===');
    
    const membersToInclude = groupMembersWithLoans.slice(0, 5); // First 5 members
    
    for (const member of membersToInclude) {
      const memberRecord = await prisma.groupMemberPeriodicRecord.create({
        data: {
          groupPeriodicRecordId: periodicRecord.id,
          memberId: member.id,
          compulsoryContribution: 300,
          loanRepaymentPrincipal: 100,
          lateFinePaid: 0
        }
      });
      
      console.log(`   ✅ Created member record for ${member.name}`);
    }

    // Test the API call
    console.log('\n=== 4. TESTING NEW RECORD API CALL ===');
    
    const apiResponse = await prisma.groupPeriodicRecord.findUnique({
      where: { id: periodicRecord.id },
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

    // Show the loan data that the frontend will receive
    console.log('\n=== 5. FRONTEND WILL RECEIVE ===');
    
    apiResponse.memberRecords.forEach((mr, index) => {
      const member = mr.member;
      const initialLoan = member.initialLoanAmount || 0;
      const currentBalance = member.loans?.reduce((sum, loan) => sum + loan.currentBalance, 0) || 0;
      
      console.log(`   ${index + 1}. ${member.name}:`);
      console.log(`      memberCurrentLoanBalance: ₹${currentBalance}`);
      console.log(`      Initial loan (if displayed): ₹${initialLoan}`);
      console.log(`      Contribution: ₹${mr.compulsoryContribution}`);
    });

    console.log('\n🎉 SUCCESS! Frontend test URL:');
    console.log(`   http://localhost:3000/groups/${groupId}/periodic-records/${periodicRecord.id}`);
    
    console.log('\n📋 Expected Results:');
    console.log('   - Loan Amount column should show the current balances listed above');
    console.log('   - Values should be properly formatted with ₹ symbol');
    console.log('   - Members should show non-zero loan amounts where applicable');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error message:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestRecordWithLoans();
