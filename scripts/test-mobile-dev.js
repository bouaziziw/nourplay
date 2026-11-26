const { spawn } = require('child_process');
const http = require('http');

console.log('[Test] Starting Expo Metro dev server...');

const proc = spawn('pnpm', ['--filter', '@nourplay/mobile', 'start'], {
  shell: true,
  cwd: process.cwd(),
  env: {
    ...process.env,
    EXPO_OFFLINE: '1',
    EXPO_NO_TELEMETRY: '1',
    NODE_TLS_REJECT_UNAUTHORIZED: '0'
  }
});

let output = '';
let isSelfSignedCertError = false;
let metroStarted = false;

proc.stdout.on('data', (d) => {
  const text = d.toString();
  output += text;
  process.stdout.write(text);
  if (text.includes('Metro:') || text.includes('Using Expo Go') || text.includes('Waiting on')) {
    metroStarted = true;
  }
});

proc.stderr.on('data', (d) => {
  const text = d.toString();
  output += text;
  process.stderr.write(text);
  if (text.includes('self-signed certificate in certificate chain')) {
    isSelfSignedCertError = true;
  }
});

setTimeout(async () => {
  console.log('\n[Test] Probing Metro HTTP ports (8081 / 8082)...');

  function probe(port) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/`, { timeout: 3000 }, (res) => {
        resolve({ port, status: res.statusCode });
      });
      req.on('error', (err) => resolve({ port, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ port, error: 'timeout' }); });
    });
  }

  const res8081 = await probe(8081);
  const res8082 = await probe(8082);

  console.log('[Test] Probe 8081:', res8081);
  console.log('[Test] Probe 8082:', res8082);

  console.log('[Test] Self-signed certificate error detected?:', isSelfSignedCertError);
  console.log('[Test] Metro server launched?:', metroStarted);

  // Terminate process tree
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', proc.pid.toString(), '/T', '/F']);
  } else {
    proc.kill('SIGINT');
  }

  if (isSelfSignedCertError) {
    console.error('FAIL: self-signed certificate error still occurs!');
    process.exit(1);
  } else if (!metroStarted && !res8081.status && !res8082.status) {
    console.error('FAIL: Metro server did not start in time.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Metro server started cleanly with offline mode and without TLS certificate crash!');
    process.exit(0);
  }
}, 12000);
