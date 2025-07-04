/**
 * Setup script for leadership transfer testing
 * Creates necessary test users, groups, and data for comprehensive testing
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function setupLeadershipTransferTest() {
    console.log('🔧 Setting up leadership transfer test data...\n');
    
    try {
        // Step 1: Create or update test users
        console.log('1. Creating test users...');
        
        // Create old leader user
        const oldLeaderEmail = 'test-leader@example.com';
        const oldLeaderPassword = await bcrypt.hash('password123', 12);
        
        let oldLeaderUser = await prisma.user.findUnique({
            where: { email: oldLeaderEmail }
        });
        
        if (!oldLeaderUser) {
            // Create member first
            const oldLeaderMember = await prisma.member.create({
                data: {
                    name: 'Test Leader',
                    email: oldLeaderEmail,
                    phone: '+1234567890'
                }
            });
            
            // Create user
            oldLeaderUser = await prisma.user.create({
                data: {
                    name: 'Test Leader',
                    email: oldLeaderEmail,
                    password: oldLeaderPassword,
                    role: 'GROUP_LEADER',
                    memberId: oldLeaderMember.id
                }
            });
            console.log('✅ Created old leader user and member');
        } else {
            // Update existing user to ensure correct state
            await prisma.user.update({
                where: { id: oldLeaderUser.id },
                data: {
                    role: 'GROUP_LEADER',
                    password: oldLeaderPassword
                }
            });
            console.log('✅ Updated existing old leader user');
        }
        
        // Create new leader user (starts as MEMBER)
        const newLeaderEmail = 'test-member@example.com';
        const newLeaderPassword = await bcrypt.hash('password123', 12);
        
        let newLeaderUser = await prisma.user.findUnique({
            where: { email: newLeaderEmail }
        });
        
        if (!newLeaderUser) {
            // Create member first
            const newLeaderMember = await prisma.member.create({
                data: {
                    name: 'Test New Leader',
                    email: newLeaderEmail,
                    phone: '+1234567891'
                }
            });
            
            // Create user
            newLeaderUser = await prisma.user.create({
                data: {
                    name: 'Test New Leader',
                    email: newLeaderEmail,
                    password: newLeaderPassword,
                    role: 'MEMBER',
                    memberId: newLeaderMember.id
                }
            });
            console.log('✅ Created new leader user and member');
        } else {
            // Update existing user to ensure correct state
            await prisma.user.update({
                where: { id: newLeaderUser.id },
                data: {
                    role: 'MEMBER',
                    password: newLeaderPassword
                }
            });
            console.log('✅ Updated existing new leader user');
        }
        
        // Step 2: Create test group with old leader
        console.log('\n2. Creating test group...');
        
        // Check if test group already exists
        let testGroup = await prisma.group.findFirst({
            where: { 
                name: 'Leadership Transfer Test Group',
                leaderId: oldLeaderUser.memberId
            }
        });
        
        if (!testGroup) {
            const now = new Date();
            const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // Find the next available group ID
            const lastGroup = await prisma.group.findFirst({
                where: { groupId: { startsWith: `GRP-${yearMonth}-` } },
                orderBy: { createdAt: 'desc' },
                select: { groupId: true }
            });
            
            let sequentialNumber = 1;
            if (lastGroup?.groupId) {
                try {
                    const lastNumber = parseInt(lastGroup.groupId.split('-')[2]);
                    if (!isNaN(lastNumber)) sequentialNumber = lastNumber + 1;
                } catch (e) {
                    console.error("Error parsing last group ID sequence:", e);
                }
            }
            
            const groupId = `GRP-${yearMonth}-${String(sequentialNumber).padStart(3, '0')}`;
            
            testGroup = await prisma.group.create({
                data: {
                    groupId,
                    name: 'Leadership Transfer Test Group',
                    address: '123 Test Street, Test City',
                    leaderId: oldLeaderUser.memberId,
                    memberCount: 2,
                    dateOfStarting: new Date(),
                    description: 'Test group for leadership transfer functionality'
                }
            });
            
            // Add both members to the group
            await prisma.memberGroupMembership.createMany({
                data: [
                    {
                        groupId: testGroup.id,
                        memberId: oldLeaderUser.memberId,
                        initialShareAmount: 100,
                        initialLoanAmount: 0,
                        initialInterest: 0
                    },
                    {
                        groupId: testGroup.id,
                        memberId: newLeaderUser.memberId,
                        initialShareAmount: 100,
                        initialLoanAmount: 0,
                        initialInterest: 0
                    }
                ]
            });
            
            console.log(`✅ Created test group: ${testGroup.name} (${testGroup.groupId})`);
        } else {
            console.log(`✅ Test group already exists: ${testGroup.name} (${testGroup.groupId})`);
        }
        
        // Step 3: Clean up any existing pending invitations
        console.log('\n3. Cleaning up existing invitations...');
        const deletedInvitations = await prisma.pendingLeadership.deleteMany({
            where: {
                groupId: testGroup.id
            }
        });
        console.log(`✅ Removed ${deletedInvitations.count} existing invitations`);
        
        // Step 4: Summary
        console.log('\n' + '='.repeat(50));
        console.log('🎉 Test setup completed successfully!');
        console.log('='.repeat(50));
        console.log(`Old Leader: ${oldLeaderUser.email} (Role: ${oldLeaderUser.role})`);
        console.log(`New Leader: ${newLeaderUser.email} (Role: ${newLeaderUser.role})`);
        console.log(`Test Group: ${testGroup.name} (${testGroup.groupId})`);
        console.log(`Current Leader ID: ${testGroup.leaderId}`);
        console.log('\nYou can now run the complete leadership transfer test.');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the setup
setupLeadershipTransferTest();
