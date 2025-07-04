const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';
const TEST_GROUP_ID = '68466fdfad5c6b70fdd420d7';

async function testPeriodClosingWorkflow() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db();
        
        console.log('🧪 Testing Complete Period Closing Workflow\n');
        
        // Step 1: Find the current open period
        const openPeriod = await db.collection('periods').findOne({
            groupId: TEST_GROUP_ID,
            status: 'open'
        });
        
        if (!openPeriod) {
            console.log('❌ No open period found for testing');
            return;
        }
        
        console.log(`📅 Found open period: ${openPeriod.periodNumber} (${openPeriod._id})`);
        
        // Step 2: Check contributions for this period
        const contributions = await db.collection('contributions').find({
            groupId: TEST_GROUP_ID,
            periodId: openPeriod._id.toString()
        }).toArray();
        
        console.log(`💰 Found ${contributions.length} contributions in open period`);
        
        // Step 3: Check existing periodic records
        const existingRecords = await db.collection('periodicrecords').find({
            groupId: TEST_GROUP_ID,
            periodId: openPeriod._id.toString()
        }).toArray();
        
        console.log(`📋 Found ${existingRecords.length} existing periodic records`);
        
        // Step 4: Get group members
        const members = await db.collection('members').find({
            groupId: TEST_GROUP_ID
        }).toArray();
        
        console.log(`👥 Group has ${members.length} members`);
        
        // Step 5: Calculate what periodic records should be created
        console.log('\n🔄 Simulating period closing...');
        
        // Get previous period's records for standing calculation
        const previousPeriods = await db.collection('periods').find({
            groupId: TEST_GROUP_ID,
            status: 'closed',
            periodNumber: { $lt: openPeriod.periodNumber }
        }).sort({ periodNumber: -1 }).limit(1).toArray();
        
        let previousRecords = [];
        if (previousPeriods.length > 0) {
            previousRecords = await db.collection('periodicrecords').find({
                groupId: TEST_GROUP_ID,
                periodId: previousPeriods[0]._id.toString()
            }).toArray();
        }
        
        console.log(`📊 Previous period had ${previousRecords.length} records`);
        
        // Calculate expected periodic records
        const expectedRecords = [];
        
        for (const member of members) {
            const contribution = contributions.find(c => c.memberId === member._id.toString());
            const previousRecord = previousRecords.find(r => r.memberId === member._id.toString());
            
            const contributionAmount = contribution ? contribution.amount : 0;
            const previousStanding = previousRecord ? previousRecord.groupStanding : 0;
            const newStanding = previousStanding + contributionAmount;
            
            expectedRecords.push({
                memberId: member._id.toString(),
                memberName: member.name,
                contributionAmount,
                previousStanding,
                newStanding,
                contribution: contribution || null
            });
        }
        
        console.log('\n📈 Expected periodic records:');
        expectedRecords.forEach((record, index) => {
            console.log(`${index + 1}. ${record.memberName}: ₹${record.contributionAmount} (Standing: ₹${record.previousStanding} → ₹${record.newStanding})`);
        });
        
        // Step 6: Actually close the period
        console.log('\n🔒 Closing period...');
        
        const closeResult = await db.collection('periods').updateOne(
            { _id: openPeriod._id },
            { 
                $set: { 
                    status: 'closed',
                    closedAt: new Date()
                }
            }
        );
        
        console.log(`✅ Period status updated: ${closeResult.modifiedCount} document(s) modified`);
        
        // Step 7: Create periodic records
        const periodicRecordsToCreate = [];
        
        for (const expected of expectedRecords) {
            const periodicRecord = {
                groupId: TEST_GROUP_ID,
                periodId: openPeriod._id.toString(),
                memberId: expected.memberId,
                memberName: expected.memberName,
                contributionAmount: expected.contributionAmount,
                groupStanding: expected.newStanding,
                cashBalance: 0, // Will be calculated separately
                loanBalance: 0, // Will be calculated separately
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            periodicRecordsToCreate.push(periodicRecord);
        }
        
        const insertResult = await db.collection('periodicrecords').insertMany(periodicRecordsToCreate);
        console.log(`📋 Created ${insertResult.insertedCount} periodic records`);
        
        // Step 8: Calculate and update cash balances
        console.log('\n💰 Calculating cash balances...');
        
        const allPeriods = await db.collection('periods').find({
            groupId: TEST_GROUP_ID,
            status: 'closed'
        }).sort({ periodNumber: 1 }).toArray();
        
        let runningCashBalance = 0;
        
        for (const period of allPeriods) {
            const periodContributions = await db.collection('contributions').find({
                groupId: TEST_GROUP_ID,
                periodId: period._id.toString()
            }).toArray();
            
            const totalContributions = periodContributions.reduce((sum, c) => sum + c.amount, 0);
            runningCashBalance += totalContributions;
            
            // Update periodic records for this period
            await db.collection('periodicrecords').updateMany(
                {
                    groupId: TEST_GROUP_ID,
                    periodId: period._id.toString()
                },
                {
                    $set: { cashBalance: runningCashBalance }
                }
            );
            
            console.log(`Period ${period.periodNumber}: Total contributions ₹${totalContributions}, Running cash balance: ₹${runningCashBalance}`);
        }
        
        // Step 9: Verify the results
        console.log('\n✅ Verification:');
        
        const finalRecords = await db.collection('periodicrecords').find({
            groupId: TEST_GROUP_ID,
            periodId: openPeriod._id.toString()
        }).toArray();
        
        console.log(`📋 Created ${finalRecords.length} periodic records`);
        
        const closedPeriod = await db.collection('periods').findOne({ _id: openPeriod._id });
        console.log(`📅 Period status: ${closedPeriod.status}`);
        
        // Step 10: Test record editing
        console.log('\n✏️ Testing record editing...');
        
        if (finalRecords.length > 0) {
            const recordToEdit = finalRecords[0];
            const originalStanding = recordToEdit.groupStanding;
            const newStanding = originalStanding + 100; // Add ₹100
            
            console.log(`Editing record for ${recordToEdit.memberName}: ₹${originalStanding} → ₹${newStanding}`);
            
            const editResult = await db.collection('periodicrecords').updateOne(
                { _id: recordToEdit._id },
                { 
                    $set: { 
                        groupStanding: newStanding,
                        updatedAt: new Date()
                    }
                }
            );
            
            console.log(`✅ Record edited: ${editResult.modifiedCount} document(s) modified`);
            
            // Verify the edit
            const editedRecord = await db.collection('periodicrecords').findOne({ _id: recordToEdit._id });
            console.log(`✅ Verified: Standing updated to ₹${editedRecord.groupStanding}`);
        }
        
        // Step 11: Test period reopening
        console.log('\n🔓 Testing period reopening...');
        
        const reopenResult = await db.collection('periods').updateOne(
            { _id: openPeriod._id },
            { 
                $set: { 
                    status: 'open',
                    reopenedAt: new Date()
                },
                $unset: { closedAt: 1 }
            }
        );
        
        console.log(`✅ Period reopened: ${reopenResult.modifiedCount} document(s) modified`);
        
        // Delete periodic records when reopening
        const deleteResult = await db.collection('periodicrecords').deleteMany({
            groupId: TEST_GROUP_ID,
            periodId: openPeriod._id.toString()
        });
        
        console.log(`🗑️ Deleted ${deleteResult.deletedCount} periodic records`);
        
        // Step 12: Test closing again
        console.log('\n🔒 Testing closing again...');
        
        const recloseResult = await db.collection('periods').updateOne(
            { _id: openPeriod._id },
            { 
                $set: { 
                    status: 'closed',
                    closedAt: new Date()
                }
            }
        );
        
        console.log(`✅ Period re-closed: ${recloseResult.modifiedCount} document(s) modified`);
        
        // Recreate periodic records
        const recreateResult = await db.collection('periodicrecords').insertMany(periodicRecordsToCreate);
        console.log(`📋 Recreated ${recreateResult.insertedCount} periodic records`);
        
        console.log('\n🎉 Period closing workflow test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during period closing test:', error);
    } finally {
        await client.close();
    }
}

// Run the test
testPeriodClosingWorkflow().catch(console.error);
