#!/usr/bin/env node
/**
 * ASCENDRA Secret Detection Scanner
 * Developer D — CI/CD & Automated Quality Pipeline
 * 
 * Scans project files to ensure no real credentials, private keys, or API tokens
 * are accidentally committed into the repository.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Directories to skip
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'Library',
  'Temp',
  'Logs',
  'UserSettings',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'dist',
  'build'
]);

// File patterns to skip
const IGNORE_FILES = [
  /\.env\.example$/,
  /package-lock\.json$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.ico$/,
  /\.fbx$/,
  /\.meta$/,
  /\.asset$/,
  /\.inputactions$/,
  /\.controller$/,
  /\.unity$/
];

// Patterns representing potential hardcoded secrets
const SECRET_RULES = [
  {
    name: 'OpenAI Secret Key',
    regex: /sk-[a-zA-Z0-9_-]{20,}/g,
    isIgnored: (match) => match.includes('placeholder') || match.includes('dummy') || match.includes('example')
  },
  {
    name: 'Google API Key',
    regex: /AIza[0-9A-Za-z_-]{35}/g,
    isIgnored: (match) => match.includes('placeholder') || match.includes('dummy')
  },
  {
    name: 'Private Key Header',
    regex: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g,
    isIgnored: () => false
  },
  {
    name: 'Hardcoded Database Password in Connection URI',
    regex: /postgres(?:ql)?:\/\/(?!postgres:postgres|ascendra_user:your_secure_password)[a-zA-Z0-9_.-]+:[^@\s/]+@[a-zA-Z0-9_.-]+/g,
    isIgnored: (match) =>
      match.includes('localhost') ||
      match.includes('example.com') ||
      match.includes('placeholder') ||
      match.includes('[password]') ||
      match.includes(':password@')
  }
];

let totalFilesScanned = 0;
const detectedSecrets = [];

function scanDirectory(currentPath) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      if (IGNORE_FILES.some(pattern => pattern.test(entry.name))) {
        continue;
      }

      // Check if file is inside a test folder (allow test mocks)
      const isTestFile = relPath.includes('tests') || relPath.includes('test_');

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        totalFilesScanned++;

        for (const rule of SECRET_RULES) {
          let match;
          while ((match = rule.regex.exec(content)) !== null) {
            const matchedValue = match[0];
            if (rule.isIgnored(matchedValue)) {
              continue;
            }

            // Skip test mock secrets in test directories
            if (isTestFile && (matchedValue.includes('test_') || matchedValue.includes('mock'))) {
              continue;
            }

            // Find line number
            const linesUpToMatch = content.slice(0, match.index).split('\n');
            const lineNumber = linesUpToMatch.length;

            detectedSecrets.push({
              file: relPath,
              line: lineNumber,
              rule: rule.name,
              preview: matchedValue.slice(0, 10) + '...'
            });
          }
        }
      } catch (err) {
        // Skip unreadable files
      }
    }
  }
}

console.log('🔍 [ASCENDRA SECRETS SCANNER] Scanning repository for exposed credentials...');
scanDirectory(ROOT_DIR);

console.log(`📊 Scanned ${totalFilesScanned} files across repository.`);

if (detectedSecrets.length > 0) {
  console.error('\n❌ [SECURITY VIOLATION] Potential hardcoded secrets detected:');
  detectedSecrets.forEach(({ file, line, rule, preview }) => {
    console.error(`  - [${rule}] in ${file}:${line} (${preview})`);
  });
  console.error('\nPlease remove hardcoded secrets and use environment variables instead.');
  process.exit(1);
} else {
  console.log('✅ [SECURITY CHECK PASSED] No exposed secrets detected in tracked files.\n');
  process.exit(0);
}
