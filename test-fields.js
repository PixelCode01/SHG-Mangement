#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNewFields() {
  try {
    console.log('Testing new fields in Group model...');
    
    // Find any group
    const group = await prisma.group.findFirst({
      select: {
        id: true,
        name: true,
        loanInsuranceBalance: true,
        groupSocialBalance: true,
        includeDataTillCurrentPeriod: true,
        currentPeriodMonth: true,
        currentPeriodYear: true
      }
    });
    
    if (group) {
      console.log('✅ Group found with new fields:');
      console.log('- ID:', group.id);
      console.log('- Name:', group.name);
      console.log('- Loan Insurance Balance:', group.loanInsuranceBalance);
      console.log('- Group Social Balance:', group.groupSocialBalance);
      console.log('- Include Data Till Current Period:', group.includeDataTillCurrentPeriod);
      console.log('- Current Period Month:', group.currentPeriodMonth);
      console.log('- Current Period Year:', group.currentPeriodYear);
    } else {
      console.log('❌ No groups found in database');
    }
    
    // Test creating a group with new fields
    console.log('\nTesting creating a group with new fields...');
    try {
      const testGroup = await prisma.group.create({
        data: {
          groupId: `TEST-${Date.now()}`,
          name: 'Test Group for New Fields',
          loanInsuranceBalance: 1000,
          groupSocialBalance: 500,
          includeDataTillCurrentPeriod: true,
          currentPeriodMonth: 7,
          currentPeriodYear: 2025
        }
      });
      
      console.log('✅ Test group created successfully:', testGroup.name);
      console.log('- Loan Insurance Balance:', testGroup.loanInsuranceBalance);
      console.log('- Group Social Balance:', testGroup.groupSocialBalance);
      console.log('- Include Data Till Current Period:', testGroup.includeDataTillCurrentPeriod);
      console.log('- Current Period Month:', testGroup.currentPeriodMonth);
      console.log('- Current Period Year:', testGroup.currentPeriodYear);
      
      // Clean up - delete the test group
      await prisma.group.delete({
        where: { id: testGroup.id }
      });
      console.log('✅ Test group cleaned up');
      
    } catch (createError) {
      console.error('❌ Error creating test group:', createError.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing new fields:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testNewFields();
