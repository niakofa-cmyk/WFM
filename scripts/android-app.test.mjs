import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { androidAssetLinks } from './android-assetlinks.mjs';

const root = new URL('../artifacts/war-for-mars/android/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('Android associations accept public SHA-256 fingerprints and only identify staging', () => {
  const fingerprint = Array(32).fill('ab').join(':');
  const [link] = androidAssetLinks(fingerprint);
  assert.deepEqual(link.relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(link.target.package_name, 'com.niakofa.wfm.staging');
  assert.deepEqual(link.target.sha256_cert_fingerprints, [fingerprint.toUpperCase()]);
});

test('Android association rejects placeholders, private keys and malformed fingerprints', () => {
  for (const invalid of [null, '', 'TODO', '-----BEGIN PRIVATE KEY-----', 'a'.repeat(64),
    Array(31).fill('AB').join(':'), Array(32).fill('ZZ').join(':')]) {
    assert.throws(() => androidAssetLinks(invalid));
  }
});

test('Android launcher pins HTTPS staging, ignores external intent URL data and has no WebView', () => {
  const config = read('app/build.gradle');
  const launcher = read('app/src/main/java/com/niakofa/wfm/LauncherActivity.java');
  const target = read('app/src/main/java/com/niakofa/wfm/LaunchTarget.java');
  const manifest = read('app/src/main/AndroidManifest.xml');
  const expected = 'https://wfm-app-staging-staging.up.railway.app/';
  assert.ok(config.includes(`applicationIdSuffix '.staging'`));
  assert.ok(config.includes(expected));
  assert.ok(target.includes(expected));
  assert.ok(launcher.includes('LaunchTarget.requireStaging(BuildConfig.GAME_URL)'));
  assert.doesNotMatch(launcher, /getIntent\(|new WebView|import android\.webkit|addJavascriptInterface|Bearer/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.doesNotMatch(manifest, /BROWSABLE|android:scheme="http"|allowMixedContent/);
  assert.doesNotMatch(config, /https:\/\/niakofa\.com/);
});

test('Android CI creates a staging APK only, with no production or Railway mutation step', () => {
  const workflow = readFileSync(new URL('../.github/workflows/android-staging.yml', import.meta.url), 'utf8');
  assert.match(workflow, /assembleStagingDebug/);
  assert.match(workflow, /testStagingDebugUnitTest/);
  assert.match(workflow, /lintStagingDebug/);
  assert.doesNotMatch(workflow, /railway |assembleProduction|bundleRelease|secrets\./);
});
