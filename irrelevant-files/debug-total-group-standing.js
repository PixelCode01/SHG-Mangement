const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugTotalGroupStanding() {
  console.log('🔍 DEBUGGING TOTAL GROUP STANDING DISCREPANCY');
  console.log('============================================\n');

  try {
    const groupId = '68452639c89581172a565838'; // Group 'jbk' - from test-cash-allocation-fix.js
    
    // Get current period with the mismatch
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
          include: {
            member: {
              include: {
                loans: { where: { status: 'ACTIVE' } }
              }
            }
          }
        }
      }
    });

    if (!currentPeriod) {
      console.log('❌ No periodic record found');
      return;
    }

    // Get group data
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: { where: { status: 'ACTIVE' } }
              }
            }
          }
        }
      }
    });

    console.log(`📋 Current Period: ${currentPeriod.meetingDate}`);
    console.log(`📊 Recorded Values in Database:`);
    console.log(`  - Cash in Hand (End): ₹${currentPeriod.cashInHandAtEndOfPeriod}`);
    console.log(`  - Cash in Bank (End): ₹${currentPeriod.cashInBankAtEndOfPeriod}`);
    console.log(`  - Total Group Standing: ₹${currentPeriod.totalGroupStandingAtEndOfPeriod}\n`);

    // Frontend calculation simulation
    console.log(`🔬 FRONTEND CALCULATION SIMULATION:`);
    
    // Simulate how frontend calculates totalLoanAssets
    const frontendTotalLoanAssets = currentPeriod.memberContributions.reduce((sum, memberContrib) => {
      const member = memberContrib.member;
      
      // Method 1: Using member.currentLoanBalance (direct field)
      const directLoanBalance = member.currentLoanBalance || 0;
      
      // Method 2: Using member.loans array
      const calculatedLoanBalance = member.loans.reduce((loanSum, loan) => loanSum + (loan.currentBalance || 0), 0);
      
      console.log(`  📋 ${member.name}:`);
      console.log(`    - Direct currentLoanBalance: ₹${directLoanBalance}`);
      console.log(`    - Calculated from loans: ₹${calculatedLoanBalance}`);
      console.log(`    - Using in calculation: ₹${directLoanBalance || calculatedLoanBalance}`);
      
      return sum + (directLoanBalance || calculatedLoanBalance);
    }, 0);

    const frontendTotalCash = (currentPeriod.cashInHandAtEndOfPeriod || 0) + (currentPeriod.cashInBankAtEndOfPeriod || 0);
    const frontendTotalGroupStanding = frontendTotalCash + frontendTotalLoanAssets;
    
    console.log(`\n📊 Frontend Calculated Values:`);
    console.log(`  - Total Cash: ₹${frontendTotalCash}`);
    console.log(`  - Total Loan Assets: ₹${frontendTotalLoanAssets}`);
    console.log(`  - Total Group Standing: ₹${frontendTotalGroupStanding}\n`);

    // Backend calculation simulation
    console.log(`⚙️ BACKEND CALCULATION SIMULATION:`);
    
    // Get loan assets using the same method as backend
    const currentTotalLoanAssets = await prisma.membership.aggregate({
      where: {
        member: {
          some: { groupId: groupId }
        }
      },
      _sum: {
        currentLoanAmount: true
      }
    });
    
    const backendTotalLoanAssets = currentTotalLoanAssets._sum.currentLoanAmount || 0;
    const backendTotalCash = (currentPeriod.cashInHandAtEndOfPeriod || 0) + (currentPeriod.cashInBankAtEndOfPeriod || 0);
    const backendTotalGroupStanding = backendTotalCash + backendTotalLoanAssets;
    
    console.log(`📊 Backend Calculated Values:`);
    console.log(`  - Total Cash: ₹${backendTotalCash}`);
    console.log(`  - Total Loan Assets: ₹${backendTotalLoanAssets}`);
    console.log(`  - Total Group Standing: ₹${backendTotalGroupStanding}\n`);

    // Also check using active loans method
    const activeLoans = await prisma.loan.findMany({
      where: {
        member: {
          groupId: groupId
        },
        status: 'ACTIVE'
      },
      select: {
        currentBalance: true,
        member: {
          select: { name: true }
        }
      }
    });

    const activeLoanTotal = activeLoans.reduce((sum, loan) => sum + (loan.currentBalance || 0), 0);
    const activeLoanTotalGroupStanding = backendTotalCash + activeLoanTotal;
    
    console.log(`🎯 ACTIVE LOANS METHOD:`);
    console.log(`  - Active Loan Total: ₹${activeLoanTotal}`);
    console.log(`  - Total Group Standing: ₹${activeLoanTotalGroupStanding}\n`);

    console.log(`🔍 COMPARISON SUMMARY:`);
    console.log(`  Database Record: ₹${currentPeriod.totalGroupStandingAtEndOfPeriod}`);
    console.log(`  Frontend Method: ₹${frontendTotalGroupStanding}`);
    console.log(`  Backend Method:  ₹${backendTotalGroupStanding}`);
    console.log(`  Active Loans:    ₹${activeLoanTotalGroupStanding}\n`);

    // Check differences
    const dbVsFrontend = Math.abs(currentPeriod.totalGroupStandingAtEndOfPeriod - frontendTotalGroupStanding);
    const dbVsBackend = Math.abs(currentPeriod.totalGroupStandingAtEndOfPeriod - backendTotalGroupStanding);
    const frontendVsBackend = Math.abs(frontendTotalGroupStanding - backendTotalGroupStanding);

    console.log(`📈 DIFFERENCES:`);
    console.log(`  DB vs Frontend: ₹${dbVsFrontend.toFixed(2)}`);
    console.log(`  DB vs Backend:  ₹${dbVsBackend.toFixed(2)}`);
    console.log(`  Frontend vs Backend: ₹${frontendVsBackend.toFixed(2)}\n`);

    if (dbVsFrontend < 0.01 && dbVsBackend < 0.01 && frontendVsBackend < 0.01) {
      console.log('✅ All calculations match! No discrepancy found.');
    } else {
      console.log('❌ Discrepancies found! Need to investigate:');
      if (dbVsFrontend > 0.01) {
        console.log(`  - Database vs Frontend differ by ₹${dbVsFrontend.toFixed(2)}`);
      }
      if (dbVsBackend > 0.01) {
        console.log(`  - Database vs Backend differ by ₹${dbVsBackend.toFixed(2)}`);
      }
      if (frontendVsBackend > 0.01) {
        console.log(`  - Frontend vs Backend differ by ₹${frontendVsBackend.toFixed(2)}`);
        console.log(`  - This suggests the frontend and backend calculate loan assets differently`);
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
debugTotalGroupStanding();
