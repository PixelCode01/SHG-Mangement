#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function testNewGroupAPI() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== Testing New Group Current Period API ===\n');
    
    // Create a new test group
    const newGroup = await prisma.group.create({
      data: {
        groupId: `TEST_NEW_${Date.now()}`,
        name: `New Test Group ${new Date().toISOString()}`,
        address: 'Test Address',
        leaderId: '67db1404f27ec8e26dfab4b7', // Use a known leader ID
        monthlyContribution: 100,
        interestRate: 2.0,
        collectionFrequency: 'MONTHLY'
      }
    });

    console.log(`✅ Created new group: ${newGroup.name}`);
    console.log(`   ID: ${newGroup.id}`);
    
    // Test the API for this new group
    console.log('\n🔍 Testing current period API for new group...');
    
    const response = await fetch(`http://localhost:3001/api/groups/${newGroup.id}/contributions/periods/current`);
    console.log(`API Response Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ API Response:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.period) {
        const periodDate = new Date(data.period.startDate);
        const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        console.log(`\n📅 Frontend will display: "${monthYear}"`);
        console.log(`🆔 Period ID: ${data.period.id}`);
        console.log(`📅 Period Date: ${periodDate.toDateString()}`);
        console.log(`🔄 Is Closed: ${data.period.isClosed}`);
        console.log(`🔢 Sequence: ${data.period.periodNumber}`);
      } else {
        console.log('\n❌ No period returned');
      }
    } else {
      const errorText = await response.text();
      console.log('\n❌ API Error:', errorText);
    }
    
    // Cleanup - delete the test group and any created periods
    await prisma.groupPeriodicRecord.deleteMany({
      where: { groupId: newGroup.id }
    });
    await prisma.group.delete({
      where: { id: newGroup.id }
    });
    console.log('\n🗑️ Cleaned up test group');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewGroupAPI();
