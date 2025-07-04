const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function findAvailableGroups() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB Atlas');
        
        const db = client.db('shg_management');
        
        // 1. List all groups
        console.log('\n=== ALL GROUPS ===');
        const groups = await db.collection('groups').find({}).toArray();
        console.log(`Found ${groups.length} groups total`);
        
        groups.forEach((group, index) => {
            console.log(`\nGroup ${index + 1}:`);
            console.log(`  ID: ${group._id}`);
            console.log(`  Name: ${group.name}`);
            console.log(`  Late Fine Enabled: ${group.lateFineEnabled}`);
            if (group.lateFineRule) {
                console.log(`  Late Fine Type: ${group.lateFineRule.type}`);
            }
            if (group.collectionSchedule) {
                console.log(`  Collection Schedule: ${JSON.stringify(group.collectionSchedule)}`);
            }
        });
        
        // 2. Check if any group has late fines enabled
        console.log('\n=== GROUPS WITH LATE FINES ENABLED ===');
        const lateFineGroups = await db.collection('groups').find({
            lateFineEnabled: true
        }).toArray();
        
        console.log(`Found ${lateFineGroups.length} groups with late fines enabled`);
        
        for (const group of lateFineGroups) {
            console.log(`\nGroup: ${group.name} (${group._id})`);
            console.log(`  Late Fine Rule: ${JSON.stringify(group.lateFineRule, null, 2)}`);
            
            // Check for tier rules if TIER_BASED
            if (group.lateFineRule && group.lateFineRule.type === 'TIER_BASED') {
                const tierRules = await db.collection('late-fine-rules').find({
                    groupId: group._id,
                    type: 'TIER_BASED'
                }).toArray();
                
                console.log(`  Tier Rules Count: ${tierRules.length}`);
                if (tierRules.length === 0) {
                    console.log(`  ❌ PROBLEM: TIER_BASED late fine rule but no tier rules defined!`);
                } else {
                    console.log(`  ✅ Tier rules are properly defined`);
                }
            }
        }
        
        // 3. Check for the specific group name pattern
        console.log('\n=== SEARCHING FOR GROUP BY NAME PATTERN ===');
        const searchPatterns = ['zx', 'test', 'sample'];
        
        for (const pattern of searchPatterns) {
            const matchingGroups = await db.collection('groups').find({
                name: new RegExp(pattern, 'i')
            }).toArray();
            
            if (matchingGroups.length > 0) {
                console.log(`Groups matching "${pattern}": ${matchingGroups.length}`);
                matchingGroups.forEach(group => {
                    console.log(`  - ${group.name} (${group._id})`);
                });
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

findAvailableGroups();
