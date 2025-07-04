const { PrismaClient } = require('@prisma/client');

async function debugLateFineDiscrepancy() {
  console.log('=== DEBUGGING LATE FINE DISCREPANCY ===');
  const prisma = new PrismaClient();
  
  try {
    const groupId = '6847e1af178e279a3c1f546a';
    
    // Get group with late fine rules
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        lateFineRules: true,
        memberships: {
          include: {
            member: true
          }
        },
        groupPeriodicRecords: {
          where: { 
            totalCollectionThisPeriod: { not: null }
          },
          orderBy: { meetingDate: 'desc' },
          take: 1,
          include: {
            memberContributions: {
              include: {
                member: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('Group not found');
      return;
    }

    console.log(`\nGroup: ${group.name}`);
    console.log(`Monthly Contribution: ₹${group.monthlyContribution || 0}`);
    console.log(`Interest Rate: ${group.interestRate || 0}%`);
    console.log(`Collection Frequency: ${group.collectionFrequency}`);
    console.log(`Members: ${group.memberships.length}`);

    // Check late fine rules
    console.log(`\nLate Fine Rules: ${group.lateFineRules.length}`);
    for (const rule of group.lateFineRules) {
      console.log(`- Rule Type: ${rule.ruleType}`);
      console.log(`- Enabled: ${rule.isEnabled}`);
      console.log(`- Daily Amount: ₹${rule.dailyAmount || 0}`);
      console.log(`- Daily Percentage: ${rule.dailyPercentage || 0}%`);
      if (rule.tierRules) {
        console.log(`- Tier Rules:`, rule.tierRules);
      }
    }

    // Simulate frontend late fine calculation
    const lateFineRule = group.lateFineRules?.[0];
    const expectedContribution = group.monthlyContribution || 0;
    
    // Calculate days late like the frontend does
    const today = new Date();
    const calculateNextDueDate = (groupData) => {
      const frequency = groupData.collectionFrequency || 'MONTHLY';
      const targetDay = groupData.collectionDayOfMonth || 1;
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      let dueDate = new Date(currentYear, currentMonth, targetDay);
      
      if (dueDate <= today) {
        dueDate = new Date(currentYear, currentMonth + 1, targetDay);
      }
      
      return dueDate;
    };
    
    const dueDate = calculateNextDueDate(group);
    const daysLate = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    console.log(`\nDate Calculations:`);
    console.log(`- Today: ${today.toDateString()}`);
    console.log(`- Due Date: ${dueDate.toDateString()}`);
    console.log(`- Days Late: ${daysLate}`);

    // Calculate late fine
    let frontendLateFinePerMember = 0;
    if (lateFineRule && lateFineRule.isEnabled && daysLate > 0) {
      switch (lateFineRule.ruleType) {
        case 'DAILY_FIXED':
          frontendLateFinePerMember = (lateFineRule.dailyAmount || 0) * daysLate;
          break;
        case 'DAILY_PERCENTAGE':
          frontendLateFinePerMember = expectedContribution * (lateFineRule.dailyPercentage || 0) / 100 * daysLate;
          break;
        case 'TIER_BASED':
          let totalFine = 0;
          const tierRules = lateFineRule.tierRules || [];
          
          for (const tier of tierRules) {
            if (daysLate >= tier.startDay) {
              const daysInTier = Math.min(daysLate, tier.endDay) - tier.startDay + 1;
              if (tier.isPercentage) {
                totalFine += expectedContribution * (tier.amount / 100) * daysInTier;
              } else {
                totalFine += tier.amount * daysInTier;
              }
            }
          }
          frontendLateFinePerMember = totalFine;
          break;
      }
    }

    console.log(`\nFrontend Late Fine Calculation:`);
    console.log(`- Late fine per member: ₹${frontendLateFinePerMember.toFixed(2)}`);
    console.log(`- Total late fines (${group.memberships.length} members): ₹${(frontendLateFinePerMember * group.memberships.length).toFixed(2)}`);

    // Calculate frontend total expected (like the frontend does)
    let frontendTotalExpected = 0;
    for (const membership of group.memberships) {
      const memberExpectedContribution = expectedContribution;
      const memberExpectedInterest = 0; // We'll calculate this differently per member based on loans
      const memberLateFine = frontendLateFinePerMember;
      const memberTotal = memberExpectedContribution + memberExpectedInterest + memberLateFine;
      frontendTotalExpected += memberTotal;
    }

    console.log(`\nFrontend Calculations:`);
    console.log(`- Expected Contribution per member: ₹${expectedContribution}`);
    console.log(`- Expected Contribution total: ₹${(expectedContribution * group.memberships.length).toFixed(2)}`);
    console.log(`- Late fines total: ₹${(frontendLateFinePerMember * group.memberships.length).toFixed(2)}`);
    console.log(`- Frontend Total Expected: ₹${frontendTotalExpected.toFixed(2)}`);

    // Compare with backend
    if (group.groupPeriodicRecords.length > 0) {
      const period = group.groupPeriodicRecords[0];
      console.log(`\nLatest Period (Backend):`);
      console.log(`- Period Date: ${period.meetingDate}`);
      console.log(`- Member contributions: ${period.memberContributions.length}`);
      
      let backendTotalExpected = 0;
      let backendTotalLateFines = 0;
      
      period.memberContributions.forEach(contrib => {
        const expected = (contrib.compulsoryContributionDue || 0) + 
                        (contrib.loanInterestDue || 0) + 
                        (contrib.lateFineAmount || 0);
        backendTotalExpected += expected;
        backendTotalLateFines += (contrib.lateFineAmount || 0);
      });
      
      console.log(`- Backend Total Expected: ₹${backendTotalExpected.toFixed(2)}`);
      console.log(`- Backend Total Late Fines: ₹${backendTotalLateFines.toFixed(2)}`);
      console.log(`- Discrepancy: ₹${Math.abs(frontendTotalExpected - backendTotalExpected).toFixed(2)}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLateFineDiscrepancy().then(() => {
  console.log('Debug completed');
}).catch(err => {
  console.error('Debug error:', err);
});
