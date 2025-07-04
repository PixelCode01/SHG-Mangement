#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testActualAPI() {
  try {
    console.log('🔍 TESTING ACTUAL API WITH EXISTING GROUPS\n');

    // Use one of the existing groups
    const groupId = '68382afd6cad8afd7cf5bb1f'; // 'bb' group
    
    console.log(`📊 Testing Group: ${groupId}`);

    // Get group data first
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
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

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`✅ Group found: ${group.name}`);
    console.log(`   Members: ${group.memberships.length}`);

    // Check for loan data in members
    console.log('\n=== CHECKING MEMBER LOAN DATA ===');
    group.memberships.forEach((membership, index) => {
      const member = membership.member;
      const initialLoan = member.initialLoanAmount || membership.initialLoanAmount || 0;
      const activeLoans = member.loans?.length || 0;
      const currentBalance = member.loans?.reduce((sum, loan) => sum + loan.currentBalance, 0) || 0;
      
      console.log(`   ${index + 1}. ${member.name}:`);
      console.log(`      Initial Loan: ₹${initialLoan}`);
      console.log(`      Active Loans: ${activeLoans}`);
      console.log(`      Current Balance: ₹${currentBalance}`);
    });

    // Get periodic records
    const records = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: groupId },
      orderBy: { meetingDate: 'desc' },
      take: 1
    });

    if (records.length === 0) {
      console.log('\n❌ No periodic records found');
      return;
    }

    const recordId = records[0].id;
    console.log(`\n📝 Testing Periodic Record: ${recordId}`);

    // Now simulate the exact API call that the frontend makes
    console.log('\n=== SIMULATING FRONTEND API CALL ===');
    
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
      console.log('❌ API response failed');
      return;
    }

    console.log(`✅ API Response received`);
    console.log(`   Member Records: ${apiResponse.memberRecords.length}`);

    // Process each member record like the frontend does
    console.log('\n=== PROCESSING LIKE FRONTEND ===');
    
    apiResponse.memberRecords.forEach((apiMr, index) => {
      console.log(`\n👤 Member ${index + 1}:`);
      console.log(`   Member ID: ${apiMr.memberId}`);
      console.log(`   Member Name: ${apiMr.member?.name || 'Unknown'}`);
      
      if (!apiMr.member) {
        console.log(`   ❌ ISSUE: No member data attached!`);
        return;
      }
      
      console.log(`   Initial Loan Amount: ₹${apiMr.member.initialLoanAmount || 0}`);
      
      const loans = apiMr.member.loans || [];
      console.log(`   Active Loans: ${loans.length}`);
      
      // Replicate exact frontend logic
      const currentLoanBalance = loans.reduce((total, loan) => {
        const balance = typeof loan.currentBalance === 'number' ? loan.currentBalance : parseFloat(loan.currentBalance) || 0;
        console.log(`     Loan: ₹${balance} (type: ${typeof loan.currentBalance})`);
        return total + balance;
      }, 0) || 0;
      
      console.log(`   🧮 Calculated Current Balance: ₹${currentLoanBalance}`);
      console.log(`   📋 memberCurrentLoanBalance would be: ₹${currentLoanBalance}`);
    });

    // Create test loan data if none exists
    if (group.memberships.every(m => (m.member.initialLoanAmount || 0) === 0 && (m.member.loans?.length || 0) === 0)) {
      console.log('\n⚠️  NO LOAN DATA EXISTS - Creating test data...');
      
      // Create test loan for first member
      const firstMember = group.memberships[0];
      if (firstMember) {
        console.log(`\n💰 Creating test loan for ${firstMember.member.name}...`);
        
        // Set initial loan amount
        await prisma.member.update({
          where: { id: firstMember.member.id },
          data: { initialLoanAmount: 5000 }
        });
        
        // Create active loan
        const testLoan = await prisma.loan.create({
          data: {
            memberId: firstMember.member.id,
            groupId: groupId,
            loanType: 'PERSONAL',
            originalAmount: 3000,
            currentBalance: 2400,
            interestRate: 0.12,
            status: 'ACTIVE',
            dateIssued: new Date()
          }
        });
        
        console.log(`✅ Created test data:`);
        console.log(`   Initial Loan: ₹5000`);
        console.log(`   Active Loan: ₹3000 (Current: ₹2400)`);
        console.log(`\n🌐 Test URL:`);
        console.log(`   http://localhost:3000/groups/${groupId}/periodic-records/${recordId}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testActualAPI();
