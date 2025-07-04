#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugFrontendLoanDisplay() {
  try {
    console.log('🔍 DEBUGGING FRONTEND LOAN DISPLAY ISSUE\n');

    // Use the specific IDs from the tests
    const groupId = '68381a2c05cb588247af871e';
    const recordId = '68381a3405cb588247af8752';

    console.log(`📊 Checking Group: ${groupId}`);
    console.log(`📝 Checking Record: ${recordId}\n`);

    // First, let's see what the API should return (simulate the API call)
    console.log('=== 1. SIMULATING API CALL ===');
    
    const apiResponse = await prisma.groupPeriodicRecord.findUnique({
      where: { id: recordId },
      include: {
        memberRecords: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!apiResponse) {
      console.log('❌ Periodic record not found');
      return;
    }

    console.log(`✅ Found periodic record: ${apiResponse.id}`);
    console.log(`   Meeting Date: ${apiResponse.meetingDate}`);
    console.log(`   Member Records: ${apiResponse.memberRecords.length}\n`);

    // Process member records exactly like the frontend does
    console.log('=== 2. PROCESSING MEMBER RECORDS (Frontend Logic) ===');
    
    apiResponse.memberRecords.forEach((apiMr, index) => {
      console.log(`\n👤 Member ${index + 1}: ${apiMr.member?.name || 'Unknown'}`);
      console.log(`   Member ID: ${apiMr.memberId}`);
      console.log(`   Initial Loan Amount: ₹${apiMr.member?.initialLoanAmount || 0}`);
      
      // Replicate frontend loan calculation logic
      const loans = apiMr.member?.loans || [];
      console.log(`   Active Loans Count: ${loans.length}`);
      
      if (loans.length > 0) {
        loans.forEach((loan, loanIndex) => {
          const balance = typeof loan.currentBalance === 'number' ? loan.currentBalance : parseFloat(loan.currentBalance) || 0;
          console.log(`     Loan ${loanIndex + 1}: ₹${balance} (type: ${typeof loan.currentBalance})`);
        });
      }
      
      // Calculate current loan balance exactly like frontend
      const currentLoanBalance = loans.reduce((total, loan) => {
        const balance = typeof loan.currentBalance === 'number' ? loan.currentBalance : parseFloat(loan.currentBalance) || 0;
        return total + balance;
      }, 0) || 0;
      
      console.log(`   🧮 Calculated Current Balance: ₹${currentLoanBalance}`);
      
      // This is what should be set as memberCurrentLoanBalance
      console.log(`   📋 Would set memberCurrentLoanBalance: ₹${currentLoanBalance}`);
    });

    // Now let's check if there are any active loans at all
    console.log('\n=== 3. CHECKING ALL ACTIVE LOANS IN GROUP ===');
    
    const allActiveLoans = await prisma.loan.findMany({
      where: {
        groupId: groupId,
        status: 'ACTIVE'
      },
      include: {
        member: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`📈 Total Active Loans in Group: ${allActiveLoans.length}`);
    
    if (allActiveLoans.length > 0) {
      allActiveLoans.forEach((loan, index) => {
        console.log(`   ${index + 1}. ${loan.member.name}: ₹${loan.currentBalance} (Original: ₹${loan.originalAmount})`);
      });
    } else {
      console.log('⚠️  No active loans found in the group!');
    }

    // Check if members have initialLoanAmount
    console.log('\n=== 4. CHECKING INITIAL LOAN AMOUNTS ===');
    
    const memberships = await prisma.memberGroupMembership.findMany({
      where: { groupId: groupId },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            initialLoanAmount: true
          }
        }
      }
    });

    console.log(`👥 Total Memberships: ${memberships.length}`);
    
    memberships.forEach((membership, index) => {
      const initialLoan = membership.member.initialLoanAmount || membership.initialLoanAmount || 0;
      console.log(`   ${index + 1}. ${membership.member.name}: Initial ₹${initialLoan}`);
    });

    // Final diagnosis
    console.log('\n=== 5. DIAGNOSIS ===');
    
    if (allActiveLoans.length === 0 && memberships.every(m => !m.member.initialLoanAmount && !m.initialLoanAmount)) {
      console.log('❌ ISSUE IDENTIFIED: No loan data exists at all');
      console.log('   - No active loans in the group');
      console.log('   - No initial loan amounts on members');
      console.log('   - Frontend correctly shows ₹0.00 because there are no loans');
    } else if (allActiveLoans.length === 0) {
      console.log('⚠️  PARTIAL ISSUE: Only initial loans exist, no active loans');
      console.log('   - Initial loans exist but no active loan records');
      console.log('   - Frontend only shows current balance (₹0.00) correctly');
      console.log('   - Missing: Initial loan amount column');
    } else {
      console.log('✅ EXPECTED: Loan data exists and should be displayed');
      console.log('   - Frontend calculation logic looks correct');
      console.log('   - Issue might be in the table rendering or API response');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFrontendLoanDisplay();
