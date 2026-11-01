import { pathToFileURL } from 'node:url';

// Public signing-certificate fingerprint only. Never accepts a keystore/private key.
export function androidAssetLinks(fingerprint) {
  if (typeof fingerprint !== 'string' ||
      !/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(fingerprint)) {
    throw new Error('Expected a colon-separated SHA-256 public certificate fingerprint');
  }
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.niakofa.wfm.staging',
      sha256_cert_fingerprints: [fingerprint.toUpperCase()],
    },
  }];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(androidAssetLinks(process.argv[2]), null, 2)}\n`);
  } catch {
    console.error('Supply only the public SHA-256 certificate fingerprint; see docs/android-app.md.');
    process.exitCode = 1;
  }
}
