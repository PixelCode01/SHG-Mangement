#!/usr/bin/env node

/**
 * Debug what the frontend API is actually returning
 */

const fetch = require('node-fetch');

async function debugFrontendAPI() {
  try {
    console.log('🔍 Testing frontend API for "sa" group...\n');
    
    const groupId = '684d067814ef22028b799a71';
    const url = `http://localhost:3001/api/groups/${groupId}`;
    
    console.log(`Making request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        // Note: This won't work without authentication, but let's see what we get
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 401) {
      console.log('❌ Authentication required - this is expected');
      console.log('   The API requires authentication, so we can\'t test directly from Node.js');
      console.log('   But the issue might be that the frontend is not properly reading the tier rules');
      return;
    }
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API response successful');
      console.log('\n📊 Late Fine Configuration in API Response:');
      
      if (data.lateFineRules && data.lateFineRules.length > 0) {
        const rule = data.lateFineRules[0];
        console.log(`   Rule ID: ${rule.id}`);
        console.log(`   Enabled: ${rule.isEnabled}`);
        console.log(`   Type: ${rule.ruleType}`);
        
        if (rule.tierRules && rule.tierRules.length > 0) {
          console.log('   Tier Rules:');
          rule.tierRules
            .sort((a, b) => a.startDay - b.startDay)
            .forEach((tier, i) => {
              const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
              console.log(`     ${i+1}. Days ${tier.startDay}-${endText}: ₹${tier.amount}/day`);
            });
        } else {
          console.log('   ❌ No tier rules in API response');
        }
      } else {
        console.log('   ❌ No late fine rules in API response');
      }
    } else {
      console.log('❌ API error:', data);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

debugFrontendAPI();
