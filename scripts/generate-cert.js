const fs = require('node:fs');
const path = require('node:path');
const selfsigned = require('selfsigned');

async function generateCertificate() {
  const certificateDirectory = path.resolve(__dirname, '..', 'certs');
  fs.mkdirSync(certificateDirectory, { recursive: true });

  const attributes = [{ name: 'commonName', value: 'localhost' }];
  const extensions = [{
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' }
    ]
  }];
  const pems = await selfsigned.generate(attributes, {
    algorithm: 'sha256',
    keySize: 2048,
    days: 365,
    extensions
  });

  fs.writeFileSync(path.join(certificateDirectory, 'localhost.key'), pems.private, { mode: 0o600 });
  fs.writeFileSync(path.join(certificateDirectory, 'localhost.crt'), pems.cert, { mode: 0o644 });
  console.log('Local HTTPS certificate generated in certs/.');
}

generateCertificate().catch(() => {
  console.error('Certificate generation failed.');
  process.exit(1);
});
