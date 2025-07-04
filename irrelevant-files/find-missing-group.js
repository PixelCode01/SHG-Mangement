const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function findMissingGroup() {
    console.log('🔍 SEARCHING FOR MISSING GROUP');
    console.log('===============================\n');
    
    const targetGroupId = '684ab648ba9fb9c7e6784ca5';
    console.log(`🎯 Looking for group: ${targetGroupId}\n`);
    
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        
        // 1. List all databases
        const adminDb = client.db().admin();
        const dbList = await adminDb.listDatabases();
        
        console.log('📊 AVAILABLE DATABASES:');
        dbList.databases.forEach(db => {
            console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
        
        // 2. Check each database for groups collections
        for (const database of dbList.databases) {
            if (database.name === 'admin' || database.name === 'local') continue;
            
            console.log(`\n🗄️ CHECKING DATABASE: ${database.name}`);
            console.log('='.repeat(50));
            
            const db = client.db(database.name);
            
            try {
                // List collections
                const collections = await db.listCollections().toArray();
                console.log(`Collections: ${collections.map(c => c.name).join(', ')}`);
                
                if (collections.find(c => c.name === 'groups')) {
                    // Check for our target group
                    const targetGroup = await db.collection('groups').findOne({ 
                        _id: new ObjectId(targetGroupId) 
                    });
                    
                    if (targetGroup) {
                        console.log(`✅ FOUND TARGET GROUP in ${database.name}!`);
                        console.log(`Name: ${targetGroup.name}`);
                        console.log(`Late Fine Rule:`, JSON.stringify(targetGroup.lateFineRule, null, 2));
                        return { database: database.name, group: targetGroup };
                    }
                    
                    // List all groups in this database
                    const allGroups = await db.collection('groups').find({}).toArray();
                    console.log(`📋 Found ${allGroups.length} groups:`);
                    
                    allGroups.slice(0, 5).forEach(group => {
                        console.log(`  - ${group.name} (${group._id})`);
                    });
                    
                    if (allGroups.length > 5) {
                        console.log(`  ... and ${allGroups.length - 5} more`);
                    }
                }
            } catch (error) {
                console.log(`❌ Error accessing ${database.name}:`, error.message);
            }
        }
        
        // 3. If not found, check if it might be a different ObjectId format
        console.log('\n🔍 SEARCHING BY PARTIAL ID MATCH...');
        for (const database of dbList.databases) {
            if (database.name === 'admin' || database.name === 'local') continue;
            
            const db = client.db(database.name);
            
            try {
                if (await db.collection('groups').findOne({})) {
                    const groups = await db.collection('groups').find({
                        _id: { $regex: targetGroupId.substring(0, 10) }
                    }).toArray();
                    
                    if (groups.length > 0) {
                        console.log(`📍 Found similar IDs in ${database.name}:`);
                        groups.forEach(group => {
                            console.log(`  - ${group.name} (${group._id})`);
                        });
                    }
                }
            } catch (error) {
                // ObjectId regex might not work, skip
            }
        }
        
        // 4. Let's also check what the application config says
        console.log('\n🔧 APPLICATION CONFIGURATION:');
        console.log(`MONGODB_URI: ${MONGODB_URI}`);
        
        return null;
        
    } catch (error) {
        console.error('❌ Search failed:', error);
        return null;
    } finally {
        await client.close();
    }
}

findMissingGroup().then(result => {
    if (!result) {
        console.log('\n❌ Group not found in any database');
        console.log('\n🤔 POSSIBLE REASONS:');
        console.log('1. Group exists in a different MongoDB instance');
        console.log('2. Application is using a different connection string');
        console.log('3. Group ID is incorrect or has been deleted');
        console.log('4. Application is using a different database system (PostgreSQL?)');
        console.log('\n💡 NEXT STEPS:');
        console.log('1. Check the application .env file');
        console.log('2. Look at the actual frontend network requests');
        console.log('3. Check if this is using Prisma with PostgreSQL instead');
    }
}).catch(error => {
    console.error('Script failed:', error);
});
