/**
 * Clixer - Health Check Script
 * Servislerin ayakta olup olmadığını kontrol eder.
 */

const http = require('http');

const services = [
  { name: 'Gateway', url: 'http://localhost:4000/health' },
  { name: 'Auth', url: 'http://localhost:4001/health' },
  { name: 'Core', url: 'http://localhost:4002/health' },
  { name: 'Data', url: 'http://localhost:4003/health' },
  { name: 'Analytics', url: 'http://localhost:4005/health' }
];

async function checkService(service) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(service.url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - start;
        if (res.statusCode === 200) {
          resolve({ name: service.name, status: 'OK', duration: `${duration}ms`, ok: true });
        } else {
          resolve({ name: service.name, status: `FAIL (${res.statusCode})`, duration: `${duration}ms`, ok: false });
        }
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - start;
      resolve({ name: service.name, status: `ERROR (${err.message})`, duration: `${duration}ms`, ok: false });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ name: service.name, status: 'TIMEOUT', duration: '5000ms', ok: false });
    });
  });
}

async function runAllChecks() {
  console.log('=== Clixer Health Check Basliyor ===\n');
  
  const results = await Promise.all(services.map(checkService));
  
  let allOk = true;
  results.forEach(res => {
    const icon = res.ok ? '✓' : '✗';
    const statusColor = res.ok ? '' : '! ';
    console.log(`${icon} ${res.name.padEnd(12)}: ${res.status} (${res.duration})`);
    if (!res.ok) allOk = false;
  });

  console.log('\n=== Check Tamamlandi ===');
  
  if (!allOk) {
    console.log('!!! BAZI SERVISLER AYAKTA DEGIL !!!');
    process.exit(1);
  } else {
    console.log('✅ Tum servisler saglikli.');
    process.exit(0);
  }
}

runAllChecks();
