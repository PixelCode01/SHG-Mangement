#!/usr/bin/env node

/**
 * Simple Production API Test to diagnose the 500 error
 */

const fs = require('fs');

const PRODUCTION_URL = 'https://shg-mangement.vercel.app';

async function diagnoseProdutionIssue() {
  console.log('🔍 DIAGNOSING PRODUCTION ISSUE');
  console.log('================================');

  try {
    // Test 1: Simple GET request
    console.log('1️⃣ Testing GET endpoint...');
    const getResponse = await fetch(`${PRODUCTION_URL}/api/pdf-upload-v18`);
    const getData = await getResponse.json();
    console.log('✅ GET successful:', getData.version);

    // Test 2: Try with a minimal FormData
    console.log('2️⃣ Testing with minimal POST...');
    
    const formData = new FormData();
    // Create a small test buffer instead of reading the actual PDF
    const testBuffer = Buffer.from('test');
    const testBlob = new Blob([testBuffer], { type: 'application/pdf' });
    formData.append('pdf', testBlob, 'test.pdf');

    const response = await fetch(`${PRODUCTION_URL}/api/pdf-upload-v18`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ POST failed with ${response.status}: ${response.statusText}`);
      console.log('Error body:', errorText);
    } else {
      const result = await response.json();
      console.log('✅ POST successful:', result.message);
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

diagnoseProdutionIssue();
