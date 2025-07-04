#!/usr/bin/env node

/**
 * Comprehensive validation of late fine calculation system
 * This script validates that late fine rules are properly configured and calculates expected late fines
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function validateLateFineSystem() {
  try {
    console.log('🔍 VALIDATING LATE FINE CALCULATION SYSTEM\n');
    
    // Test the specific group mentioned in the issue
    const groupId = '684a9bed1a17ec4cb2831dce';
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        lateFineRules: {
          include: {
            tierRules: {
              orderBy: { startDay: 'asc' }
            }
          }
        }
      }
    });
    
    if (!group) {
      console.log('❌ Group not found');
      return;
    }
    
    console.log(`📋 Group: ${group.name}`);
    console.log(`📅 Collection: ${group.collectionFrequency} on the ${group.collectionDayOfMonth}${getOrdinalSuffix(group.collectionDayOfMonth)}`);
    
    // Validate late fine rules
    console.log(`\n⚖️ Late Fine Rules Validation:`);
    if (group.lateFineRules.length === 0) {
      console.log('❌ No late fine rules found');
      return;
    }
    
    const lateFineRule = group.lateFineRules[0];
    console.log(`   Rule ID: ${lateFineRule.id}`);
    console.log(`   Enabled: ${lateFineRule.isEnabled ? '✅' : '❌'}`);
    console.log(`   Type: ${lateFineRule.ruleType}`);
    console.log(`   Tier Rules: ${lateFineRule.tierRules.length}`);
    
    if (lateFineRule.ruleType === 'TIER_BASED') {
      if (lateFineRule.tierRules.length === 0) {
        console.log('❌ TIER_BASED rule has no tier rules defined!');
        return;
      }
      
      console.log(`\n   📊 Tier Structure:`);
      lateFineRule.tierRules.forEach((tier, i) => {
        const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
        console.log(`     Tier ${i + 1}: Days ${tier.startDay}-${endText} = ₹${tier.amount}/day`);
      });
    }
    
    // Calculate late fine for current date
    console.log(`\n🧮 Late Fine Calculation Test:`);
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Calculate due date for current month
    let dueDate = new Date(currentYear, currentMonth, group.collectionDayOfMonth);
    
    // Handle case where due date hasn't come this month yet
    if (dueDate > today) {
      // Use previous month's due date
      dueDate = new Date(currentYear, currentMonth - 1, group.collectionDayOfMonth);
    }
    
    const timeDiff = today.getTime() - dueDate.getTime();
    const daysLate = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
    
    console.log(`   Today: ${today.toLocaleDateString()}`);
    console.log(`   Last Due Date: ${dueDate.toLocaleDateString()}`);
    console.log(`   Days Late: ${daysLate}`);
    
    if (daysLate > 0 && lateFineRule.isEnabled) {
      const lateFineAmount = calculateLateFine(lateFineRule, daysLate, 100); // Assuming ₹100 contribution
      console.log(`   Expected Late Fine (₹100 contribution): ₹${lateFineAmount}`);
      
      if (lateFineAmount > 0) {
        console.log(`   ✅ Late fine calculation is working!`);
      } else {
        console.log(`   ❌ Late fine calculation returned 0 despite being ${daysLate} days late`);
      }
    } else if (daysLate === 0) {
      console.log(`   ✅ No late fine (contributions are on time)`);
    } else {
      console.log(`   ❌ Late fine rules are disabled`);
    }
    
    // Test various scenarios
    console.log(`\n🧪 Late Fine Test Scenarios:`);
    const testScenarios = [
      { days: 1, contribution: 100 },
      { days: 5, contribution: 100 },
      { days: 10, contribution: 100 },
      { days: 20, contribution: 100 },
      { days: 30, contribution: 100 }
    ];
    
    testScenarios.forEach(scenario => {
      const fine = calculateLateFine(lateFineRule, scenario.days, scenario.contribution);
      console.log(`   ${scenario.days} days late (₹${scenario.contribution} contribution): ₹${fine}`);
    });
    
    console.log(`\n🌐 Test URL: http://localhost:3000/groups/${groupId}/contributions`);
    console.log(`\n📝 Summary:`);
    console.log(`   - Late fine rules: ${lateFineRule.isEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   - Rule type: ${lateFineRule.ruleType}`);
    console.log(`   - Tier rules: ${lateFineRule.tierRules.length > 0 ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`   - Current status: ${daysLate > 0 ? `${daysLate} days late` : 'On time'}`);
    
    if (lateFineRule.isEnabled && lateFineRule.tierRules.length > 0) {
      console.log(`   ✅ Late fine system should be working properly!`);
    } else {
      console.log(`   ❌ Late fine system needs configuration`);
    }
    
  } catch (error) {
    console.error('❌ Error validating late fine system:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function calculateLateFine(lateFineRule, daysLate, contributionAmount) {
  if (!lateFineRule.isEnabled || daysLate <= 0) {
    return 0;
  }
  
  switch (lateFineRule.ruleType) {
    case 'DAILY_FIXED':
      return (lateFineRule.dailyAmount || 0) * daysLate;
      
    case 'DAILY_PERCENTAGE':
      const dailyRate = (lateFineRule.dailyPercentage || 0) / 100;
      return Math.round((contributionAmount * dailyRate * daysLate) * 100) / 100;
      
    case 'TIER_BASED':
      if (!lateFineRule.tierRules || lateFineRule.tierRules.length === 0) {
        return 0;
      }
      
      // Find the applicable tier
      for (const tier of lateFineRule.tierRules) {
        if (daysLate >= tier.startDay && daysLate <= tier.endDay) {
          if (tier.isPercentage) {
            return Math.round((contributionAmount * tier.amount / 100 * daysLate) * 100) / 100;
          } else {
            return tier.amount * daysLate;
          }
        }
      }
      return 0;
      
    default:
      return 0;
  }
}

function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

validateLateFineSystem();
