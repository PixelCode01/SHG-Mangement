
// File: fix-vercel-conditional-loading.js
const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, 'app/layout.tsx');
const content = fs.readFileSync(layoutPath, 'utf8');

const updatedContent = content
  .replace('<SpeedInsights />', '{process.env.NODE_ENV === \'production\' && <SpeedInsights />}')
  .replace('<Analytics />', '{process.env.NODE_ENV === \'production\' && <Analytics />}');

fs.writeFileSync(layoutPath, updatedContent);
console.log('✅ Vercel components made conditional');
  