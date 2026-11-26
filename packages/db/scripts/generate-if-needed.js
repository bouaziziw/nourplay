const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const generatedClientPath = path.join(__dirname, '..', 'generated', 'client', 'index.js');
const generatedSchemaPath = path.join(__dirname, '..', 'generated', 'client', 'schema.prisma');

const shouldGenerate =
  !fs.existsSync(generatedClientPath) ||
  !fs.existsSync(generatedSchemaPath) ||
  fs.statSync(schemaPath).mtimeMs > fs.statSync(generatedSchemaPath).mtimeMs;

if (shouldGenerate) {
  console.log('[db] Generating Prisma client...');
  execSync('prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} else {
  console.log('[db] Prisma client is up-to-date, skipping redundant generation.');
}
