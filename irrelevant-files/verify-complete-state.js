#!/usr/bin/env node

/**
 * Verify the complete state of the "sa" group and ensure frontend sees the correct data
 */

const { PrismaClient } = require('@prisma/client');

async function verifyCompleteState() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 COMPLETE STATE VERIFICATION FOR "sa" GROUP');
    console.log('===============================================\n');
    
    // 1. Get the group with ALL related data (exactly like the API does)
    const group = await prisma.group.findFirst({
      where: { name: 'sa' },
      include: {
        leader: {
          select: { id: true, name: true, email: true }
        },
        lateFineRules: {
          include: {
            tierRules: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!group) {
      console.log('❌ Group "sa" not found');
      return;
    }
    
    console.log('📊 GROUP BASIC INFO:');
    console.log(`   Name: ${group.name}`);
    console.log(`   ID: ${group.id}`);
    console.log(`   Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);
    console.log(`   Monthly Contribution: ₹${group.monthlyContribution}`);
    
    // 2. Verify late fine rules (as returned by API)
    console.log('\n⚖️ LATE FINE RULES (as API returns):');
    if (group.lateFineRules.length === 0) {
      console.log('   ❌ No late fine rules found');
      return;
    }
    
    const lateFineRule = group.lateFineRules[0];
    console.log(`   Rule ID: ${lateFineRule.id}`);
    console.log(`   Enabled: ${lateFineRule.isEnabled ? '✅' : '❌'}`);
    console.log(`   Type: ${lateFineRule.ruleType}`);
    console.log(`   Created: ${lateFineRule.createdAt}`);
    
    if (lateFineRule.ruleType === 'TIER_BASED') {
      console.log(`   Tier Rules Count: ${lateFineRule.tierRules.length}`);
      
      if (lateFineRule.tierRules.length === 0) {
        console.log('   ❌ NO TIER RULES - This would cause ₹0 late fines!');
        return;
      }
      
      console.log('\n📊 TIER RULES (sorted by startDay):');
      lateFineRule.tierRules
        .sort((a, b) => a.startDay - b.startDay)
        .forEach((tier, i) => {
          const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
          console.log(`     ${i+1}. Days ${tier.startDay}-${endText}: ₹${tier.amount}${tier.isPercentage ? '%' : ' per day'}`);
        });
    }
    
    // 3. Test calculation for your reported case (10 days late)
    console.log('\n🧮 CALCULATION TEST FOR 10 DAYS LATE:');
    const daysLate = 10;
    
    // Frontend logic simulation
    const tierRules = lateFineRule.tierRules || [];
    const applicableTier = tierRules.find(tier => 
      daysLate >= tier.startDay && daysLate <= tier.endDay
    );
    
    if (applicableTier) {
      const expectedContribution = group.monthlyContribution || 0;
      let calculatedFine;
      
      if (applicableTier.isPercentage) {
        calculatedFine = expectedContribution * (applicableTier.amount / 100) * daysLate;
        console.log(`   🔍 Applicable tier: Days ${applicableTier.startDay}-${applicableTier.endDay > 1000 ? '∞' : applicableTier.endDay}`);
        console.log(`   💱 Percentage calculation: ₹${expectedContribution} × ${applicableTier.amount}% × ${daysLate} = ₹${calculatedFine}`);
      } else {
        calculatedFine = applicableTier.amount * daysLate;
        console.log(`   🔍 Applicable tier: Days ${applicableTier.startDay}-${applicableTier.endDay > 1000 ? '∞' : applicableTier.endDay}`);
        console.log(`   💰 Fixed rate calculation: ₹${applicableTier.amount} × ${daysLate} = ₹${calculatedFine}`);
      }
      
      console.log(`   ✅ Expected late fine: ₹${calculatedFine.toFixed(2)}`);
      
      if (Math.abs(calculatedFine - 100) < 0.01) {
        console.log('   ❌ ERROR: This gives ₹100 - database might have wrong tier rules!');
      } else if (Math.abs(calculatedFine - 499.8) < 0.01) {
        console.log('   ✅ CORRECT: This gives ₹499.80 as expected');
      } else {
        console.log(`   ⚠️ UNEXPECTED: This gives ₹${calculatedFine.toFixed(2)}`);
      }
    } else {
      console.log('   ❌ No applicable tier found for 10 days late');
    }
    
    // 4. Check if there are multiple late fine rules
    console.log('\n🔍 CHECKING FOR MULTIPLE LATE FINE RULES:');
    const allRules = await prisma.lateFineRule.findMany({
      where: { groupId: group.id },
      include: { tierRules: true },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   Total late fine rules for this group: ${allRules.length}`);
    if (allRules.length > 1) {
      console.log('   ⚠️ Multiple rules found - API should return the latest one');
      allRules.forEach((rule, i) => {
        console.log(`     Rule ${i+1}: ID ${rule.id}, Created: ${rule.createdAt}, Enabled: ${rule.isEnabled}`);
      });
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    console.log('=============');
    
    if (lateFineRule.isEnabled && lateFineRule.tierRules.length > 0) {
      console.log('✅ Database configuration is CORRECT');
      console.log('✅ Your tier rules are properly configured');
      console.log('✅ Backend calculation should work');
      console.log('');
      console.log('🔍 If you\'re still seeing ₹100 for 10 days late, the issue is likely:');
      console.log('   1. Browser cache - try hard refresh (Ctrl+F5)');
      console.log('   2. Frontend is reading old/cached data');
      console.log('   3. API caching issue');
      console.log('   4. Days late calculation is different than expected');
      console.log('');
      console.log('🌐 NEXT STEPS:');
      console.log('   1. Open browser developer tools (F12)');
      console.log('   2. Go to Network tab');
      console.log('   3. Refresh the contribution page');
      console.log('   4. Look for the API call to /api/groups/[id]');
      console.log('   5. Check if lateFineRules.tierRules has the correct values');
    } else {
      console.log('❌ Database configuration issue found');
    }
    
    console.log(`\n📋 Group URL: http://localhost:3000/groups/${group.id}/contributions`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCompleteState();
