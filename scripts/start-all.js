/**
 * Start all 4 APNILEAP services as child processes.
 * Usage: node scripts/start-all.js
 */
const { spawn } = require('child_process');
const path = require('path');

const services = [
  { name: 'Team A - Eligibility', dir: 'services/team-a-eligibility', port: 3001 },
  { name: 'Team B - Ranking', dir: 'services/team-b-ranking', port: 3002 },
  { name: 'Team C - Placement', dir: 'services/team-c-placement', port: 3003 },
  { name: 'Team D - Portal', dir: 'services/team-d-portal', port: 3000 },
];

const root = path.resolve(__dirname, '..');

services.forEach(({ name, dir, port }) => {
  const proc = spawn('node', ['server.js'], {
    cwd: path.join(root, dir),
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
    shell: true,
  });
  proc.on('error', err => console.error(`[${name}] Failed to start:`, err.message));
  console.log(`[${name}] Starting on port ${port}...`);
});
