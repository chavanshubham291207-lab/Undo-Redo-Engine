const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const cppBinaryName = isWindows ? 'engine.exe' : 'engine';
const cppBinary = path.join(__dirname, 'cpp', cppBinaryName);
const cppSource = path.join(__dirname, 'cpp', 'engine.cpp');

console.log(`[Compile-Engine] OS platform: ${process.platform}`);
console.log(`[Compile-Engine] Source file: ${cppSource}`);
console.log(`[Compile-Engine] Target binary: ${cppBinary}`);

try {
  execSync(`g++ -O2 "${cppSource}" -o "${cppBinary}"`, { stdio: 'inherit' });
  if (!isWindows && fs.existsSync(cppBinary)) {
    try {
      fs.chmodSync(cppBinary, 0o755);
    } catch (e) {
      console.warn(`[Compile-Engine] chmod warning:`, e.message);
    }
  }
  console.log(`[Compile-Engine] ✓ Build successful: ${cppBinaryName}`);
} catch (err) {
  console.error(`[Compile-Engine] ⚠️ Compilation error:`, err.message);
  // Continue without throwing so postinstall doesn't fail if runtime handles it
}
