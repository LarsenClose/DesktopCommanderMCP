/**
 * Test script for remote device security
 * Tests the allowlist and device_id check ordering
 */

import assert from 'assert';

/**
 * Test 1: REMOTE_ALLOWED_TOOLS does not contain dangerous tools
 */
async function testAllowlistExcludes() {
  console.log('\nTest 1: REMOTE_ALLOWED_TOOLS excludes dangerous tools');

  // We can't easily import the const from the compiled device.ts (it's not exported),
  // so we read the source file and verify the set contents
  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const deviceSource = await fs.readFile(
    path.join(__dirname, '..', 'src', 'remote-device', 'device.ts'),
    'utf-8'
  );

  // Verify REMOTE_ALLOWED_TOOLS exists
  assert.ok(
    deviceSource.includes('REMOTE_ALLOWED_TOOLS'),
    'REMOTE_ALLOWED_TOOLS constant should exist in device.ts'
  );

  // Extract the set contents
  const setMatch = deviceSource.match(/REMOTE_ALLOWED_TOOLS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);
  assert.ok(setMatch, 'Should find REMOTE_ALLOWED_TOOLS Set definition');

  const setContents = setMatch[1];

  // Verify dangerous tools are NOT in the set
  const dangerousTools = ['kill_process', 'set_config_value', 'get_config'];
  for (const tool of dangerousTools) {
    assert.ok(
      !setContents.includes(`'${tool}'`),
      `REMOTE_ALLOWED_TOOLS should NOT contain '${tool}'`
    );
    console.log(`✓ '${tool}' correctly excluded from allowlist`);
  }
}

/**
 * Test 2: device_id check comes before tool args logging
 */
async function testDeviceIdCheckOrder() {
  console.log('\nTest 2: device_id check occurs before tool args logging');

  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const deviceSource = await fs.readFile(
    path.join(__dirname, '..', 'src', 'remote-device', 'device.ts'),
    'utf-8'
  );

  // Find the handleNewToolCall method
  const methodStart = deviceSource.indexOf('async handleNewToolCall');
  assert.ok(methodStart !== -1, 'Should find handleNewToolCall method');

  const methodBody = deviceSource.substring(methodStart, methodStart + 1000);

  // Find position of device_id check vs tool_args logging
  const deviceIdCheckPos = methodBody.indexOf('device_id !== this.deviceId');
  const toolArgsLogPos = methodBody.indexOf('JSON.stringify(tool_args)');

  assert.ok(deviceIdCheckPos !== -1, 'Should find device_id check');
  assert.ok(toolArgsLogPos !== -1, 'Should find tool_args logging');

  assert.ok(
    deviceIdCheckPos < toolArgsLogPos,
    `device_id check (pos ${deviceIdCheckPos}) should come before tool_args logging (pos ${toolArgsLogPos})`
  );

  console.log('✓ device_id check correctly ordered before tool args logging');
}

/**
 * Test 3: Blocking offline update script reads from env vars
 */
async function testBlockingScriptUsesEnvVars() {
  console.log('\nTest 3: blocking-offline-update.js reads from env vars');

  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const scriptSource = await fs.readFile(
    path.join(__dirname, '..', 'src', 'remote-device', 'scripts', 'blocking-offline-update.js'),
    'utf-8'
  );

  // Verify it reads from process.env
  assert.ok(
    scriptSource.includes('process.env.SUPABASE_URL'),
    'Script should read SUPABASE_URL from env'
  );
  assert.ok(
    scriptSource.includes('process.env.SUPABASE_KEY'),
    'Script should read SUPABASE_KEY from env'
  );
  assert.ok(
    scriptSource.includes('process.env.ACCESS_TOKEN'),
    'Script should read ACCESS_TOKEN from env'
  );
  assert.ok(
    scriptSource.includes('process.env.REFRESH_TOKEN'),
    'Script should read REFRESH_TOKEN from env'
  );

  // Verify it does NOT read these from process.argv
  // The old pattern was: const [deviceId, supabaseUrl, supabaseKey, accessToken, refreshToken] = process.argv.slice(2);
  assert.ok(
    !scriptSource.includes('supabaseUrl, supabaseKey, accessToken, refreshToken] = process.argv'),
    'Script should NOT read tokens from process.argv'
  );

  console.log('✓ Blocking script reads tokens from environment variables');
}

/**
 * Test 4: remote-channel passes tokens via env
 */
async function testRemoteChannelUsesEnv() {
  console.log('\nTest 4: remote-channel.ts passes tokens via env');

  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const channelSource = await fs.readFile(
    path.join(__dirname, '..', 'src', 'remote-device', 'remote-channel.ts'),
    'utf-8'
  );

  // Find the spawnSync call in setOffline
  const setOfflineStart = channelSource.indexOf('async setOffline');
  assert.ok(setOfflineStart !== -1, 'Should find setOffline method');

  const setOfflineBody = channelSource.substring(setOfflineStart, setOfflineStart + 3000);

  // Verify it uses env option
  assert.ok(
    setOfflineBody.includes('SUPABASE_URL:') || setOfflineBody.includes("SUPABASE_URL':"),
    'spawnSync should pass SUPABASE_URL in env'
  );
  assert.ok(
    setOfflineBody.includes('ACCESS_TOKEN:') || setOfflineBody.includes("ACCESS_TOKEN':"),
    'spawnSync should pass ACCESS_TOKEN in env'
  );

  // Verify tokens are NOT passed as positional args anymore
  // The old pattern had 6 args: scriptPath, deviceId, supabaseUrl, supabaseKey, accessToken, refreshToken
  // Now it should only have: scriptPath, deviceId
  const spawnSyncMatch = setOfflineBody.match(/spawnSync\('node',\s*\[([\s\S]*?)\]/);
  assert.ok(spawnSyncMatch, 'Should find spawnSync call');

  const argsContent = spawnSyncMatch[1];
  // Count the number of items in the args array (by counting commas between non-nested items)
  const items = argsContent.split(',').map(s => s.trim()).filter(s => s.length > 0);
  assert.ok(
    items.length <= 2,
    `spawnSync should have at most 2 args (scriptPath, deviceId), found ${items.length}`
  );

  console.log('✓ remote-channel passes tokens via env, not CLI args');
}

export default async function runTests() {
  try {
    await testAllowlistExcludes();
    await testDeviceIdCheckOrder();
    await testBlockingScriptUsesEnvVars();
    await testRemoteChannelUsesEnv();

    console.log('\n✅ All remote security tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    return false;
  }
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}
