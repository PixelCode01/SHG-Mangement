#!/usr/bin/env node

/**
 * Analyze possible sources of the late fine = ₹0 issue
 * Based on the screenshot showing 15 members, monthly collection on 5th, all showing ₹0 late fines
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeLateFineSources() {
  try {
    console.log('🔍 ANALYZING LATE FINE ISSUE SOURCES\n');
    console.log('From screenshot: 15 members, monthly on 5th, ₹0 late fines for all\n');
    
    // Get all groups and analyze their late fine configurations
    const groups = await prisma.group.findMany({
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        },
        memberships: true,
        groupPeriodicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    console.log(`📊 FOUND ${groups.length} GROUPS\n`);
    
    // Possible sources of the issue ranked by likelihood
    const sources = [
      '1. LATE FINE RULES NOT CONFIGURED',
      '2. TIER_BASED RULES WITH EMPTY TIER RULES ARRAY', 
      '3. LATE FINE RULES DISABLED',
      '4. FRONTEND CALCULATION LOGIC ISSUE',
      '5. INCORRECT DUE DATE CALCULATION',
      '6. TIMEZONE ISSUES',
      '7. DATABASE-FRONTEND MISMATCH'
    ];
    
    console.log('🎯 POSSIBLE SOURCES (RANKED BY LIKELIHOOD):');
    sources.forEach(source => console.log(`   ${source}`));
    console.log('');
    
    // Analyze each group for these issues
    for (const group of groups) {
      console.log(`\n🏢 GROUP: ${group.name} (${group.id})`);
      console.log(`   Members: ${group.memberships.length}`);
      console.log(`   Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);
      
      // Check for Source 1: No late fine rules
      if (!group.lateFineRules || group.lateFineRules.length === 0) {
        console.log('   ❌ SOURCE 1: NO LATE FINE RULES CONFIGURED');
        continue;
      }
      
      const lateFineRule = group.lateFineRules[0];
      console.log(`   Late Fine Rule: ${lateFineRule.ruleType} (${lateFineRule.isEnabled ? 'enabled' : 'disabled'})`);
      
      // Check for Source 3: Rules disabled
      if (!lateFineRule.isEnabled) {
        console.log('   ❌ SOURCE 3: LATE FINE RULES DISABLED');
        continue;
      }
      
      // Check for Source 2: TIER_BASED with empty tier rules
      if (lateFineRule.ruleType === 'TIER_BASED') {
        if (!lateFineRule.tierRules || lateFineRule.tierRules.length === 0) {
          console.log('   ❌ SOURCE 2: TIER_BASED WITH EMPTY TIER RULES ARRAY');
          console.log('      This is the classic late fine bug!');
          continue;
        } else {
          console.log(`   ✅ Tier rules configured: ${lateFineRule.tierRules.length} tiers`);
        }
      }
      
      // Check for Source 4 & 5: Calculate what late fine should be
      const today = new Date();
      let dueDate;
      
      if (group.collectionFrequency === 'MONTHLY') {
        const targetDay = group.collectionDayOfMonth || 5;
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        dueDate = new Date(currentYear, currentMonth, targetDay);
        
        // If due date hasn't come this month, use last month
        if (dueDate > today) {
          dueDate = new Date(currentYear, currentMonth - 1, targetDay);
        }
      } else {
        dueDate = new Date(group.createdAt);
      }
      
      const timeDiff = today.getTime() - dueDate.getTime();
      const daysLate = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
      
      console.log(`   Due Date: ${dueDate.toDateString()}`);
      console.log(`   Days Late: ${daysLate}`);
      
      // Calculate expected late fine
      let expectedLateFine = 0;
      const contribution = group.monthlyContribution || 458;
      
      if (lateFineRule.ruleType === 'DAILY_FIXED' && daysLate > 0) {
        expectedLateFine = (lateFineRule.dailyAmount || 0) * daysLate;
      } else if (lateFineRule.ruleType === 'DAILY_PERCENTAGE' && daysLate > 0) {
        expectedLateFine = contribution * (lateFineRule.dailyPercentage || 0) / 100 * daysLate;
      } else if (lateFineRule.ruleType === 'TIER_BASED' && daysLate > 0) {
        for (const tier of lateFineRule.tierRules) {
          if (daysLate >= tier.startDay && daysLate <= tier.endDay) {
            if (tier.isPercentage) {
              expectedLateFine = contribution * tier.amount / 100;
            } else {
              expectedLateFine = tier.amount * daysLate;
            }
            break;
          }
        }
      }
      
      console.log(`   Expected Late Fine: ₹${expectedLateFine}`);
      
      if (expectedLateFine > 0) {
        console.log('   ✅ RULE SHOULD GENERATE LATE FINES');
        console.log('   🔍 POTENTIAL SOURCE 4: FRONTEND CALCULATION ISSUE');
      } else if (daysLate <= 0) {
        console.log('   ✅ NOT OVERDUE YET - Late fines of ₹0 are correct');
      } else {
        console.log('   ❌ RULE CONFIGURATION ISSUE');
      }
      
      // Check if this matches the screenshot criteria (15 members, monthly on 5th)
      if (group.memberships.length === 15 && group.collectionDayOfMonth === 5 && group.collectionFrequency === 'MONTHLY') {
        console.log('   🎯 THIS MATCHES THE SCREENSHOT CRITERIA!');
        console.log('   🚨 THIS IS LIKELY THE GROUP FROM THE SCREENSHOT');
        
        // Detailed analysis for this group
        console.log('\n   📊 DETAILED ANALYSIS FOR MATCHING GROUP:');
        console.log('   ========================================');
        
        if (!group.lateFineRules || group.lateFineRules.length === 0) {
          console.log('   🔧 FIX NEEDED: Create late fine rules for this group');
        } else if (!lateFineRule.isEnabled) {
          console.log('   🔧 FIX NEEDED: Enable the late fine rule');
        } else if (lateFineRule.ruleType === 'TIER_BASED' && lateFineRule.tierRules.length === 0) {
          console.log('   🔧 FIX NEEDED: Add tier rules to the TIER_BASED late fine rule');
        } else if (expectedLateFine > 0) {
          console.log('   🔧 FIX NEEDED: Frontend calculation or display issue');
          console.log('   💡 SUGGESTION: Check frontend late fine calculation logic');
        } else {
          console.log('   ✅ Configuration appears correct');
        }
      }
    }
    
    // Summary of most likely sources
    console.log('\n\n🎯 MOST LIKELY SOURCES BASED ON ANALYSIS:');
    console.log('==========================================');
    
    const groupsWith15Members = groups.filter(g => g.memberships.length === 15);
    const groupsWithMonthly5th = groups.filter(g => g.collectionDayOfMonth === 5 && g.collectionFrequency === 'MONTHLY');
    const groupsWithNoRules = groups.filter(g => !g.lateFineRules || g.lateFineRules.length === 0);
    const groupsWithEmptyTiers = groups.filter(g => 
      g.lateFineRules && g.lateFineRules.length > 0 && 
      g.lateFineRules[0].ruleType === 'TIER_BASED' && 
      (!g.lateFineRules[0].tierRules || g.lateFineRules[0].tierRules.length === 0)
    );
    
    console.log(`1. Groups with 15 members: ${groupsWith15Members.length}`);
    console.log(`2. Groups with monthly collection on 5th: ${groupsWithMonthly5th.length}`);
    console.log(`3. Groups with no late fine rules: ${groupsWithNoRules.length}`);
    console.log(`4. Groups with empty tier rules: ${groupsWithEmptyTiers.length}`);
    
    const targetGroup = groups.find(g => 
      g.memberships.length === 15 && 
      g.collectionDayOfMonth === 5 && 
      g.collectionFrequency === 'MONTHLY'
    );
    
    if (targetGroup) {
      console.log(`\n🎯 TARGET GROUP IDENTIFIED: ${targetGroup.name} (${targetGroup.id})`);
      console.log(`   URL: http://localhost:3000/groups/${targetGroup.id}/contributions`);
      
      if (!targetGroup.lateFineRules || targetGroup.lateFineRules.length === 0) {
        console.log('   📝 SOLUTION: Create late fine rules for this group');
        console.log('   💡 Run: node add-late-fine-rules-to-group.js ' + targetGroup.id);
      } else if (targetGroup.lateFineRules[0].ruleType === 'TIER_BASED' && 
                 (!targetGroup.lateFineRules[0].tierRules || targetGroup.lateFineRules[0].tierRules.length === 0)) {
        console.log('   📝 SOLUTION: Add tier rules to existing late fine rule');
        console.log('   💡 Run: node fix-tier-rules.js ' + targetGroup.id);
      } else {
        console.log('   📝 SOLUTION: Check frontend calculation logic');
        console.log('   💡 Check: app/groups/[id]/contributions/page.tsx calculateLateFine function');
      }
    } else {
      console.log('\n❓ NO EXACT MATCH FOUND - May need to check group creation date or other criteria');
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeLateFineSources();
