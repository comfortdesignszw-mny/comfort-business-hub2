const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'public', 'manifest.json');

console.log('----------------------------------------------------');
console.log('PWA Manifest & Icon Verification Script');
console.log('----------------------------------------------------');
console.log(`Reading manifest from: ${manifestPath}\n`);

if (!fs.existsSync(manifestPath)) {
  console.error(`❌ FATAL: manifest.json not found at ${manifestPath}`);
  process.exit(1);
}

let manifest;
try {
  const content = fs.readFileSync(manifestPath, 'utf8');
  manifest = JSON.parse(content);
} catch (err) {
  console.error(`❌ FATAL: Failed to parse manifest.json:`, err.message);
  process.exit(1);
}

// Collect all icon sources
const iconEntries = [];

if (Array.isArray(manifest.icons)) {
  manifest.icons.forEach((icon, idx) => {
    iconEntries.push({
      location: `manifest.icons[${idx}]`,
      src: icon.src,
      sizes: icon.sizes || 'unspecified',
      type: icon.type || 'unspecified',
      purpose: icon.purpose || 'any'
    });
  });
}

if (Array.isArray(manifest.shortcuts)) {
  manifest.shortcuts.forEach((shortcut, sIdx) => {
    if (Array.isArray(shortcut.icons)) {
      shortcut.icons.forEach((icon, iIdx) => {
        iconEntries.push({
          location: `shortcuts[${sIdx}].icons[${iIdx}]`,
          src: icon.src,
          sizes: icon.sizes || 'unspecified',
          type: icon.type || 'unspecified',
          purpose: 'shortcut'
        });
      });
    }
  });
}

console.log(`Found ${iconEntries.length} icon declaration(s) in manifest.json:\n`);

let passCount = 0;
let failCount = 0;

iconEntries.forEach((entry, idx) => {
  const relativePath = entry.src.startsWith('/') ? entry.src.slice(1) : entry.src;
  const filePath = path.join(projectRoot, 'public', relativePath);

  const num = (idx + 1).toString().padStart(2, '0');

  if (!fs.existsSync(filePath)) {
    console.error(`[${num}] ❌ FAIL (404 Not Found): ${entry.src}`);
    console.error(`     Declared in: ${entry.location} | Expected path: ${filePath}\n`);
    failCount++;
    return;
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    console.error(`[${num}] ❌ FAIL (Empty File): ${entry.src}`);
    console.error(`     File size is 0 bytes\n`);
    failCount++;
    return;
  }

  // Check PNG signature
  const buffer = fs.readFileSync(filePath);
  const isPng = buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  let dimensions = 'Unknown';
  if (isPng && buffer.length >= 24) {
    const w = buffer.readUInt32BE(16);
    const h = buffer.readUInt32BE(20);
    dimensions = `${w}x${h}`;
  }

  if (!isPng) {
    console.error(`[${num}] ❌ FAIL (Corrupted Header): ${entry.src}`);
    console.error(`     File is not a valid PNG binary\n`);
    failCount++;
    return;
  }

  console.log(`[${num}] ✅ 200 OK - Verified: ${entry.src}`);
  console.log(`     Location: ${entry.location}`);
  console.log(`     Dimensions: ${dimensions} | Size: ${stats.size} bytes | Format: PNG (Valid Header)`);
  console.log(`     Purpose: ${entry.purpose} | Declared Sizes: ${entry.sizes}\n`);
  passCount++;
});

console.log('----------------------------------------------------');
console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${iconEntries.length} checked.`);
console.log('----------------------------------------------------');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All manifest icons exist, are uncorrupted, and return 200 OK equivalent status!');
}
