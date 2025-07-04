const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function simulateGroupCreationWithLateFine() {
  try {
    console.log('🧪 Simulating group creation with late fine rules...');
    
    // Get an existing member
    const member = await prisma.member.findFirst({
      select: { id: true, name: true }
    });
    
    if (!member) {
      console.log('❌ No members found to test with');
      return;
    }
    
    // Simulate the exact payload that would be sent from the frontend
    const frontendPayload = {
      name: 'Frontend Test Group',
      address: 'Test Address',
      registrationNumber: 'TEST-FRONTEND-123',
      leaderId: member.id,
      collectionFrequency: 'MONTHLY',
      members: [
        {
          memberId: member.id,
          currentShareAmount: 1000,
          currentLoanAmount: 0
        }
      ],
      // This is the late fine rule data that was previously being ignored
      lateFineRule: {
        isEnabled: true,
        ruleType: 'TIER_BASED',
        tierRules: [
          { startDay: 1, endDay: 5, amount: 10, isPercentage: false },
          { startDay: 6, endDay: 15, amount: 25, isPercentage: false },
          { startDay: 16, endDay: 999, amount: 50, isPercentage: false }
        ]
      }
    };
    
    console.log('📤 Payload includes late fine rule:', !!frontendPayload.lateFineRule);
    console.log('📤 Late fine enabled:', frontendPayload.lateFineRule.isEnabled);
    console.log('📤 Rule type:', frontendPayload.lateFineRule.ruleType);
    console.log('📤 Tier rules:', frontendPayload.lateFineRule.tierRules.length);
    
    // Before our fix: lateFineRule would be ignored
    // After our fix: lateFineRule should be processed
    
    console.log('\n⚙️ Simulating our fixed API logic...');
    
    // Generate group ID
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
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
    
    // Apply our fixed logic
    const result = await prisma.$transaction(async (tx) => {
      // Create group
      const group = await tx.group.create({
        data: {
          groupId,
          name: frontendPayload.name,
          address: frontendPayload.address,
          registrationNumber: frontendPayload.registrationNumber,
          leaderId: frontendPayload.leaderId,
          collectionFrequency: frontendPayload.collectionFrequency,
          memberCount: frontendPayload.members.length,
          dateOfStarting: new Date(),
        }
      });
      
      console.log(`✅ Group created: ${group.id} (${group.groupId})`);
      
      // Our fix: Create late fine rule if enabled
      if (frontendPayload.lateFineRule?.isEnabled) {
        console.log('🔧 Processing late fine rule (this was the missing part)...');
        
        const newRule = await tx.lateFineRule.create({
          data: {
            groupId: group.id,
            isEnabled: true,
            ruleType: frontendPayload.lateFineRule.ruleType || 'DAILY_FIXED',
            dailyAmount: frontendPayload.lateFineRule.dailyAmount !== undefined ? frontendPayload.lateFineRule.dailyAmount : (frontendPayload.lateFineRule.ruleType === 'DAILY_FIXED' ? 10 : null),
            dailyPercentage: frontendPayload.lateFineRule.dailyPercentage !== undefined ? frontendPayload.lateFineRule.dailyPercentage : null,
          }
        });
        
        console.log(`✅ Late fine rule created: ${newRule.id}`);
        
        // Handle tier rules for TIER_BASED rule
        if (frontendPayload.lateFineRule.ruleType === 'TIER_BASED' && frontendPayload.lateFineRule.tierRules && frontendPayload.lateFineRule.tierRules.length > 0) {
          console.log(`🔧 Creating ${frontendPayload.lateFineRule.tierRules.length} tier rules...`);
          
          for (const tier of frontendPayload.lateFineRule.tierRules) {
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
          
          console.log('✅ Tier rules created successfully');
        }
      } else {
        console.log('⏭️ Late fine rule not enabled, skipping...');
      }
      
      // Create memberships
      for (const memberInfo of frontendPayload.members) {
        await tx.memberGroupMembership.create({
          data: {
            groupId: group.id,
            memberId: memberInfo.memberId,
            currentShareAmount: memberInfo.currentShareAmount || null,
            currentLoanAmount: memberInfo.currentLoanAmount || null,
          }
        });
      }
      
      return group;
    });
    
    console.log(`\n🎉 Group creation completed: ${result.id}`);
    
    // Verify the result
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
    
    if (verifyGroup?.lateFineRules && verifyGroup.lateFineRules.length > 0) {
      console.log('\n✅ VERIFICATION PASSED: Late fine rules found!');
      const rule = verifyGroup.lateFineRules[0];
      console.log(`   ✓ Rule enabled: ${rule.isEnabled}`);
      console.log(`   ✓ Rule type: ${rule.ruleType}`);
      console.log(`   ✓ Tier rules: ${rule.tierRules.length}`);
      
      console.log('\n📝 When user goes to edit this group:');
      console.log(`   → isLateFineEnabled will be: ${rule.isEnabled}`);
      console.log(`   → lateFineRuleType will be: ${rule.ruleType}`);
      console.log(`   → The form will show: "Late Fine Enabled"`);
    } else {
      console.log('\n❌ VERIFICATION FAILED: No late fine rules found');
    }
    
    // Final count
    const totalRules = await prisma.lateFineRule.count();
    console.log(`\n📊 Total late fine rules in database: ${totalRules}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

simulateGroupCreationWithLateFine();
