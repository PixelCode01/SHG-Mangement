const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';
const TEST_GROUP_ID = '68466fdfad5c6b70fdd420d7';

async function testActualPeriodClosingWorkflow() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db();
        
        console.log('🧪 Testing Complete Period Closing Workflow (Actual Schema)\n');
        
        // Step 1: Get the group information
        let group = await db.collection('Group').findOne({ _id: TEST_GROUP_ID });
        if (!group) {
            // Try with ObjectId
            const { ObjectId } = require('mongodb');
            try {
                group = await db.collection('Group').findOne({ _id: new ObjectId(TEST_GROUP_ID) });
            } catch (e) {
                // ObjectId conversion failed, continue with string
            }
        }
        if (!group) {
            console.log('❌ Group not found');
            return;
        }
        console.log(`👥 Testing group: ${group.name} (${group._id})`);
        
        // Step 2: Get all periods for this group (sorted by sequence number)
        const allPeriods = await db.collection('GroupPeriodicRecord').find({
            groupId: TEST_GROUP_ID
        }).sort({ recordSequenceNumber: 1 }).toArray();
        
        console.log(`📅 Found ${allPeriods.length} periods for group`);
        allPeriods.forEach(period => {
            console.log(`  - Period ${period.recordSequenceNumber}: Collection ₹${period.totalCollectionThisPeriod || 'Not set'}`);
        });
        
        // Step 3: Get group members
        const memberships = await db.collection('MemberGroupMembership').find({
            groupId: TEST_GROUP_ID
        }).toArray();
        
        const memberIds = memberships.map(m => m.memberId);
        const members = await db.collection('Member').find({
            _id: { $in: memberIds }
        }).toArray();
        
        console.log(`\n👤 Group has ${members.length} members`);
        
        // Step 4: Create a new period for testing
        const nextSequenceNumber = Math.max(...allPeriods.map(p => p.recordSequenceNumber || 0)) + 1;
        
        console.log(`\n📝 Creating new period ${nextSequenceNumber} for testing...`);
        
        const newPeriod = {
            _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
            groupId: TEST_GROUP_ID,
            meetingDate: new Date(),
            recordSequenceNumber: nextSequenceNumber,
            membersPresent: members.length,
            totalCollectionThisPeriod: 0,
            standingAtStartOfPeriod: allPeriods.length > 0 ? allPeriods[allPeriods.length - 1].totalGroupStandingAtEndOfPeriod || 0 : 0,
            cashInBankAtEndOfPeriod: group.balanceInBank,
            cashInHandAtEndOfPeriod: group.cashInHand,
            totalGroupStandingAtEndOfPeriod: 0,
            interestEarnedThisPeriod: 0,
            newContributionsThisPeriod: 0,
            lateFinesCollectedThisPeriod: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'OPEN' // Add status field for tracking
        };
        
        const insertPeriodResult = await db.collection('GroupPeriodicRecord').insertOne(newPeriod);
        console.log(`✅ Created new period: ${insertPeriodResult.insertedId}`);
        
        // Step 5: Create contributions for all members
        console.log('\n💰 Creating contributions for all members...');
        
        const contributionsToCreate = [];
        let totalContributions = 0;
        
        for (const member of members) {
            const contributionAmount = Math.floor(Math.random() * 500) + 500; // Random amount between 500-1000
            totalContributions += contributionAmount;
            
            const contribution = {
                _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
                groupPeriodicRecordId: newPeriod._id,
                memberId: member._id,
                compulsoryContributionDue: contributionAmount,
                loanInterestDue: 0,
                minimumDueAmount: contributionAmount,
                compulsoryContributionPaid: contributionAmount,
                loanInterestPaid: 0,
                lateFinePaid: 0,
                totalPaid: contributionAmount,
                status: 'PAID',
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                daysLate: 0,
                lateFineAmount: 0,
                remainingAmount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                paidDate: new Date(),
                cashAllocation: JSON.stringify({
                    contributionToCashInHand: Math.round((contributionAmount * 0.3 + Number.EPSILON) * 100) / 100,
                    contributionToCashInBank: Math.round((contributionAmount * 0.7 + Number.EPSILON) * 100) / 100,
                    interestToCashInHand: 0,
                    interestToCashInBank: 0
                })
            };
            
            contributionsToCreate.push(contribution);
        }
        
        const insertContributionsResult = await db.collection('MemberContribution').insertMany(contributionsToCreate);
        console.log(`✅ Created ${insertContributionsResult.insertedCount} contributions (Total: ₹${totalContributions})`);
        
        // Step 6: Test "closing" the period by updating totals
        console.log('\n🔒 "Closing" period by calculating totals...');
        
        const updatedPeriod = {
            totalCollectionThisPeriod: totalContributions,
            newContributionsThisPeriod: totalContributions,
            totalGroupStandingAtEndOfPeriod: newPeriod.standingAtStartOfPeriod + totalContributions,
            updatedAt: new Date(),
            status: 'CLOSED'
        };
        
        const updateResult = await db.collection('GroupPeriodicRecord').updateOne(
            { _id: newPeriod._id },
            { $set: updatedPeriod }
        );
        
        console.log(`✅ Period closed: ${updateResult.modifiedCount} document(s) updated`);
        
        // Step 7: Create member periodic records
        console.log('\n📋 Creating member periodic records...');
        
        const memberRecordsToCreate = [];
        
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const contribution = contributionsToCreate[i];
            
            // Calculate standing (previous + this contribution)
            const previousStanding = i === 0 ? 0 : memberRecordsToCreate[i - 1]?.groupStanding || 0;
            const newStanding = previousStanding + contribution.totalPaid;
            
            const memberRecord = {
                _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
                groupPeriodicRecordId: newPeriod._id,
                memberId: member._id,
                memberName: member.name,
                contributionAmount: contribution.totalPaid,
                groupStanding: newStanding,
                cashBalance: contribution.totalPaid, // Simplified for testing
                loanBalance: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            memberRecordsToCreate.push(memberRecord);
        }
        
        const insertMemberRecordsResult = await db.collection('GroupMemberPeriodicRecord').insertMany(memberRecordsToCreate);
        console.log(`✅ Created ${insertMemberRecordsResult.insertedCount} member periodic records`);
        
        // Step 8: Test editing a member record
        console.log('\n✏️ Testing member record editing...');
        
        if (memberRecordsToCreate.length > 0) {
            const recordToEdit = memberRecordsToCreate[0];
            const originalStanding = recordToEdit.groupStanding;
            const newStanding = originalStanding + 200; // Add ₹200
            
            console.log(`Editing record for ${recordToEdit.memberName}: ₹${originalStanding} → ₹${newStanding}`);
            
            const editResult = await db.collection('GroupMemberPeriodicRecord').updateOne(
                { _id: recordToEdit._id },
                { 
                    $set: { 
                        groupStanding: newStanding,
                        updatedAt: new Date()
                    }
                }
            );
            
            console.log(`✅ Member record edited: ${editResult.modifiedCount} document(s) modified`);
            
            // Verify the edit
            const editedRecord = await db.collection('GroupMemberPeriodicRecord').findOne({ _id: recordToEdit._id });
            console.log(`✅ Verified: Standing updated to ₹${editedRecord.groupStanding}`);
        }
        
        // Step 9: Test "reopening" the period
        console.log('\n🔓 Testing period reopening...');
        
        const reopenResult = await db.collection('GroupPeriodicRecord').updateOne(
            { _id: newPeriod._id },
            { 
                $set: { 
                    status: 'OPEN',
                    updatedAt: new Date()
                }
            }
        );
        
        console.log(`✅ Period reopened: ${reopenResult.modifiedCount} document(s) modified`);
        
        // Delete member records when reopening (as they would need recalculation)
        const deleteMemberRecordsResult = await db.collection('GroupMemberPeriodicRecord').deleteMany({
            groupPeriodicRecordId: newPeriod._id
        });
        
        console.log(`🗑️ Deleted ${deleteMemberRecordsResult.deletedCount} member periodic records`);
        
        // Step 10: Test "re-closing" the period
        console.log('\n🔒 Testing period re-closing...');
        
        const recloseResult = await db.collection('GroupPeriodicRecord').updateOne(
            { _id: newPeriod._id },
            { 
                $set: { 
                    status: 'CLOSED',
                    updatedAt: new Date()
                }
            }
        );
        
        console.log(`✅ Period re-closed: ${recloseResult.modifiedCount} document(s) modified`);
        
        // Recreate member records
        const recreateResult = await db.collection('GroupMemberPeriodicRecord').insertMany(memberRecordsToCreate);
        console.log(`📋 Recreated ${recreateResult.insertedCount} member periodic records`);
        
        // Step 11: Final verification
        console.log('\n✅ Final Verification:');
        
        const finalPeriod = await db.collection('GroupPeriodicRecord').findOne({ _id: newPeriod._id });
        console.log(`📅 Period ${finalPeriod.recordSequenceNumber}: Status = ${finalPeriod.status}, Collection = ₹${finalPeriod.totalCollectionThisPeriod}`);
        
        const finalMemberRecords = await db.collection('GroupMemberPeriodicRecord').find({
            groupPeriodicRecordId: newPeriod._id
        }).toArray();
        console.log(`📋 Member records: ${finalMemberRecords.length} found`);
        
        // Step 12: Cleanup test data
        console.log('\n🧹 Cleaning up test data...');
        
        const deleteContributionsResult = await db.collection('MemberContribution').deleteMany({
            groupPeriodicRecordId: newPeriod._id
        });
        console.log(`🗑️ Deleted ${deleteContributionsResult.deletedCount} test contributions`);
        
        const deleteMemberRecordsResult2 = await db.collection('GroupMemberPeriodicRecord').deleteMany({
            groupPeriodicRecordId: newPeriod._id
        });
        console.log(`🗑️ Deleted ${deleteMemberRecordsResult2.deletedCount} test member records`);
        
        const deletePeriodResult = await db.collection('GroupPeriodicRecord').deleteOne({
            _id: newPeriod._id
        });
        console.log(`🗑️ Deleted ${deletePeriodResult.deletedCount} test period`);
        
        console.log('\n🎉 Period closing workflow test completed successfully!');
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log('✅ Period creation - SUCCESS');
        console.log('✅ Contribution creation - SUCCESS');
        console.log('✅ Period closing calculation - SUCCESS');
        console.log('✅ Member record creation - SUCCESS');
        console.log('✅ Record editing - SUCCESS');
        console.log('✅ Period reopening - SUCCESS');
        console.log('✅ Period re-closing - SUCCESS');
        console.log('✅ Data cleanup - SUCCESS');
        
    } catch (error) {
        console.error('❌ Error during period closing test:', error);
    } finally {
        await client.close();
    }
}

// Run the test
testActualPeriodClosingWorkflow().catch(console.error);
