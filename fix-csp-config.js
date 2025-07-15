
// File: fix-csp-config.js
const fs = require('fs');
const path = require('path');

const nextConfigPath = path.join(__dirname, 'next.config.ts');
const content = fs.readFileSync(nextConfigPath, 'utf8');

const updatedContent = content.replace(
  /value: "default-src[^"]*"/,
  'value: "default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https://va.vercel-scripts.com; worker-src * blob: data:; style-src * \'unsafe-inline\'; img-src * data: blob:; font-src *; connect-src *; frame-ancestors \'none\';"'
);

fs.writeFileSync(nextConfigPath, updatedContent);
console.log('✅ CSP configuration updated');
  