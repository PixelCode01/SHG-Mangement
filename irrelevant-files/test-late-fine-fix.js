const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestGroupWithLateFine() {
  try {
    console.log('Creating test group with late fine rules...');
    
    // First, get an existing member to use as leader
    const existingMember = await prisma.member.findFirst({
      select: { id: true, name: true }
    });
    
    if (!existingMember) {
      console.log('No members found. Creating a test member first...');
      const newMember = await prisma.member.create({
        data: {
          name: 'Test Leader for Late Fine',
          email: 'testlatefine@test.com',
          phone: '1234567890'
        }
      });
      console.log(`Created test member: ${newMember.name} (${newMember.id})`);
      existingMember.id = newMember.id;
      existingMember.name = newMember.name;
    }
    
    console.log(`Using member: ${existingMember.name} (${existingMember.id})`);
    
    // Test direct database creation with our fixed logic
    await createGroupDirectly(existingMember);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function createGroupDirectly(leader) {
  try {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Generate group ID
    const lastGroup = await prisma.group.findFirst({
      where: { groupId: { startsWith: `GRP-${yearMonth}-` } },
      orderBy: { createdAt: 'desc' },
      select: { groupId: true }
    });
    
    let sequentialNumber = 1;
    if (lastGroup?.groupId) {
      const groupIdParts = lastGroup.groupId.split('-');
      if (groupIdParts.length >= 3) {
        const lastNumber = parseInt(groupIdParts[2]);
        if (!isNaN(lastNumber)) sequentialNumber = lastNumber + 1;
      }
    }
    
    const groupId = `GRP-${yearMonth}-${String(sequentialNumber).padStart(3, '0')}`;
    
    console.log(`Creating group with ID: ${groupId}`);
    
    // Create group with late fine rule in transaction (using our fixed logic)
    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          groupId,
          name: 'Test Group with Late Fine Rules',
          address: 'Test Address for Late Fine Testing',
          registrationNumber: `TEST-REG-${Date.now()}`,
          leaderId: leader.id,
          collectionFrequency: 'MONTHLY',
          memberCount: 1,
          dateOfStarting: new Date(),
        }
      });
      
      console.log(`Group created: ${group.id}`);
      
      // Create late fine rule (this is the logic we just fixed)
      const lateFineRule = {
        isEnabled: true,
        ruleType: 'TIER_BASED',
        tierRules: [
          { startDay: 1, endDay: 5, amount: 10, isPercentage: false },
          { startDay: 6, endDay: 15, amount: 25, isPercentage: false },
          { startDay: 16, endDay: 999, amount: 50, isPercentage: false }
        ]
      };
      
      if (lateFineRule?.isEnabled) {
        console.log('Creating late fine rule...');
        const newRule = await tx.lateFineRule.create({
          data: {
            groupId: group.id,
            isEnabled: true,
            ruleType: lateFineRule.ruleType || 'DAILY_FIXED',
            dailyAmount: lateFineRule.dailyAmount !== undefined ? lateFineRule.dailyAmount : (lateFineRule.ruleType === 'DAILY_FIXED' ? 10 : null),
            dailyPercentage: lateFineRule.dailyPercentage !== undefined ? lateFineRule.dailyPercentage : null,
          }
        });
        
        console.log(`Late fine rule created: ${newRule.id}`);
        
        // Handle tier rules for TIER_BASED rule
        if (lateFineRule.ruleType === 'TIER_BASED' && lateFineRule.tierRules && lateFineRule.tierRules.length > 0) {
          console.log(`Creating ${lateFineRule.tierRules.length} tier rules...`);
          for (const tier of lateFineRule.tierRules) {
            await tx.lateFineRuleTier.create({
              data: {
                lateFineRuleId: newRule.id,
                startDay: tier.startDay,
                endDay: tier.endDay,
                amount: tier.amount,
                isPercentage: tier.isPercentage
              }
            });
          }
          console.log('Tier rules created successfully');
        }
      }
      
      // Create membership
      await tx.memberGroupMembership.create({
        data: {
          groupId: group.id,
          memberId: leader.id,
          currentShareAmount: 1000,
          currentLoanAmount: 0
        }
      });
      
      return group;
    });
    
    console.log(`✅ Group created successfully: ${result.id} (${result.groupId})`);
    
    // Verify late fine rules were created
    const verifyGroup = await prisma.group.findUnique({
      where: { id: result.id },
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });
    
    if (verifyGroup && verifyGroup.lateFineRules.length > 0) {
      console.log('✅ Late fine rules verified successfully!');
      const rule = verifyGroup.lateFineRules[0];
      console.log(`   Rule Type: ${rule.ruleType}`);
      console.log(`   Enabled: ${rule.isEnabled}`);
      console.log(`   Tier Rules: ${rule.tierRules.length}`);
      rule.tierRules.forEach((tier, index) => {
        console.log(`     Tier ${index + 1}: Days ${tier.startDay}-${tier.endDay} = ₹${tier.amount}`);
      });
    } else {
      console.log('❌ Late fine rules NOT found after creation');
    }
    
    // Final verification - check total late fine rules in database
    const totalLateFineRules = await prisma.lateFineRule.count();
    console.log(`\n📊 Total late fine rules in database: ${totalLateFineRules}`);
    
  } catch (error) {
    console.error('❌ Direct creation error:', error.message);
    console.error('Stack:', error.stack);
  }
}

createTestGroupWithLateFine();
