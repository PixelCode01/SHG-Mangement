#!/usr/bin/env node

/**
 * Debug the backend API response for contributions to see if late fines are being calculated there
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugBackendContributionAPI() {
  try {
    console.log('🔍 DEBUGGING BACKEND CONTRIBUTION API');
    console.log('====================================\n');

    // Find the target group
    const group = await prisma.group.findFirst({
      where: { name: { in: ['jnw', 'ds'] } },
      include: {
        memberships: {
          include: {
            member: true
          }
        },
        lateFineRules: {
          include: {
            tierRules: true
          }
        },
        groupPeriodicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`🎯 TARGET GROUP: ${group.name} (${group.id})`);
    console.log(`📊 Members: ${group.memberships.length}`);
    console.log(`📅 Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);

    // Check the current period
    const currentPeriod = group.groupPeriodicRecords[0];
    if (!currentPeriod) {
      console.log('❌ No current period found');
      return;
    }

    console.log(`\n📋 CURRENT PERIOD: ${currentPeriod.id}`);
    console.log(`   Meeting Date: ${currentPeriod.meetingDate}`);
    console.log(`   Sequence: ${currentPeriod.recordSequenceNumber || 'N/A'}`);
    console.log(`   Created: ${currentPeriod.createdAt}`);

    // Calculate days late for this group
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const targetDay = group.collectionDayOfMonth || 5;
    
    let dueDate = new Date(currentYear, currentMonth, targetDay);
    if (dueDate > today) {
      dueDate = new Date(currentYear, currentMonth - 1, targetDay);
    }
    
    const daysLate = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    console.log(`\n📅 DATE CALCULATION:`);
    console.log(`   Today: ${today.toDateString()}`);
    console.log(`   Due Date: ${dueDate.toDateString()}`);
    console.log(`   Days Late: ${daysLate}`);

    // Check existing contribution records for this period
    const contributions = await prisma.memberContribution.findMany({
      where: {
        groupPeriodicRecordId: currentPeriod.id
      },
      include: {
        member: true
      }
    });

    console.log(`\n💳 CONTRIBUTION RECORDS: ${contributions.length} found`);
    
    if (contributions.length > 0) {
      console.log(`\n📊 BACKEND CONTRIBUTION DATA:`);
      contributions.slice(0, 5).forEach((contrib, index) => {
        console.log(`   ${index + 1}. ${contrib.member.name}:`);
        console.log(`      - Compulsory: ₹${contrib.compulsoryContributionDue || 0}`);
        console.log(`      - Interest: ₹${contrib.loanInterestDue || 0}`);
        console.log(`      - Late Fine: ₹${contrib.lateFineAmount || 0} 🔍`);
        console.log(`      - Days Late: ${contrib.daysLate || 0}`);
        console.log(`      - Status: ${contrib.status || 'N/A'}`);
        console.log(`      - Total Paid: ₹${contrib.totalPaid || 0}`);
      });
      
      if (contributions.length > 5) {
        console.log(`   ... and ${contributions.length - 5} more`);
      }
    } else {
      console.log(`   ❌ No contribution records found for current period`);
    }

    // Check if late fine rules are configured
    if (group.lateFineRules?.length > 0) {
      const lateFineRule = group.lateFineRules[0];
      console.log(`\n⚖️ LATE FINE RULE CONFIGURED:`);
      console.log(`   Type: ${lateFineRule.ruleType}`);
      console.log(`   Enabled: ${lateFineRule.isEnabled}`);
      console.log(`   Tier Rules: ${lateFineRule.tierRules?.length || 0}`);

      if (lateFineRule.tierRules?.length > 0) {
        console.log(`\n📊 TIER RULES:`);
        lateFineRule.tierRules.forEach((tier, index) => {
          const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
          console.log(`   ${index + 1}. Days ${tier.startDay}-${endText}: ₹${tier.amount} per day`);
        });

        // Calculate what late fine SHOULD be
        const applicableTier = lateFineRule.tierRules.find(tier => 
          daysLate >= tier.startDay && daysLate <= tier.endDay
        );
        
        if (applicableTier) {
          const expectedLateFine = applicableTier.amount * daysLate;
          console.log(`\n🧮 EXPECTED LATE FINE CALCULATION:`);
          console.log(`   Days Late: ${daysLate}`);
          console.log(`   Applicable Tier: ${applicableTier.startDay}-${applicableTier.endDay}`);
          console.log(`   Rate: ₹${applicableTier.amount} per day`);
          console.log(`   Expected Late Fine: ₹${expectedLateFine}`);
        }
      }
    } else {
      console.log(`\n⚖️ ❌ NO LATE FINE RULES CONFIGURED`);
    }

    // Check if the backend API logic is calculating late fines
    console.log(`\n🔎 BACKEND ISSUE ANALYSIS:`);
    console.log(`========================`);
    
    if (contributions.length === 0) {
      console.log(`   🔴 ISSUE: No contribution records exist yet`);
      console.log(`   📝 This means the backend API returns empty data`);
      console.log(`   💡 Frontend should fall back to its own calculation`);
    } else {
      const hasLateFines = contributions.some(c => (c.lateFineAmount || 0) > 0);
      const hasDaysLate = contributions.some(c => (c.daysLate || 0) > 0);
      
      if (!hasLateFines && daysLate > 0) {
        console.log(`   🔴 ISSUE: Backend has contribution records but late fines are ₹0`);
        console.log(`   📝 This means backend is not calculating late fines properly`);
        console.log(`   💡 Need to fix backend late fine calculation OR force frontend calculation`);
      }
      
      if (!hasDaysLate && daysLate > 0) {
        console.log(`   🔴 ISSUE: Backend has contribution records but daysLate is 0`);
        console.log(`   📝 This means backend is not calculating days late properly`);
        console.log(`   💡 Need to fix backend date calculation`);
      }
      
      if (hasLateFines) {
        console.log(`   ✅ Backend is calculating late fines correctly`);
      }
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugBackendContributionAPI();
