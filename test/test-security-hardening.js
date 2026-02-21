/**
 * Test script for security hardening fixes
 */

import { configManager } from '../dist/config-manager.js';
import { commandManager } from '../dist/command-manager.js';
import assert from 'assert';

async function setup() {
  const originalConfig = await configManager.getConfig();
  return originalConfig;
}

async function teardown(originalConfig) {
  await configManager.updateConfig(originalConfig);
}

/**
 * Test 1: validateCommand returns false on embedded newlines
 */
async function testNewlineInjection() {
  console.log('\nTest 1: validateCommand blocks commands with embedded newlines');

  await configManager.setValue('blockedCommands', ['sudo']);

  // Command with newline acting as command separator to bypass blocklist
  // In a real shell, newline separates commands just like ';'
  // After sanitization, \n becomes space, and ; still separates commands
  const malicious = 'echo foo\n;sudo rm -rf /';
  const result = await commandManager.validateCommand(malicious);
  assert.strictEqual(result, false, 'Command with embedded newline should be blocked when it contains a blocked command');
  console.log('✓ Newline injection blocked');
}

/**
 * Test 2: validateCommand fails closed on error
 */
async function testFailClosed() {
  console.log('\nTest 2: validateCommand fails closed on error');

  // We test this by temporarily making getConfig throw
  // Save original method
  const originalGetConfig = configManager.getConfig.bind(configManager);

  // Mock getConfig to throw
  configManager.getConfig = async () => { throw new Error('simulated config error'); };

  try {
    const result = await commandManager.validateCommand('echo hello');
    assert.strictEqual(result, false, 'Should return false (fail closed) when config errors occur');
    console.log('✓ Fails closed on validation error');
  } finally {
    // Restore original method
    configManager.getConfig = originalGetConfig;
  }
}

/**
 * Test 3: Protected config keys cannot be set via MCP tool
 */
async function testProtectedConfigKeys() {
  console.log('\nTest 3: Protected config keys blocked via MCP setConfigValue');

  // Import the setConfigValue MCP tool function
  const { setConfigValue } = await import('../dist/tools/config.js');

  const protectedKeys = ['blockedCommands', 'allowedDirectories', 'defaultShell'];

  for (const key of protectedKeys) {
    const result = await setConfigValue({ key, value: 'test' });
    assert.ok(result.isError, `Setting '${key}' should return isError`);
    assert.ok(
      result.content[0].text.includes('Cannot modify security-critical setting'),
      `Setting '${key}' should have rejection message`
    );
    console.log(`✓ Protected key '${key}' rejected`);
  }
}

/**
 * Test 4: Config value type validation
 */
async function testConfigTypeValidation() {
  console.log('\nTest 4: Config value type validation');

  // blockedCommands should reject non-array
  try {
    await configManager.setValue('blockedCommands', 'not-an-array');
    assert.fail('Should have thrown for non-array blockedCommands');
  } catch (e) {
    assert.ok(e.message.includes('array of strings'), `Error should mention array: ${e.message}`);
    console.log('✓ blockedCommands rejects non-array value');
  }

  // defaultShell should reject non-string
  try {
    await configManager.setValue('defaultShell', 123);
    assert.fail('Should have thrown for non-string defaultShell');
  } catch (e) {
    assert.ok(e.message.includes('string value'), `Error should mention string: ${e.message}`);
    console.log('✓ defaultShell rejects non-string value');
  }

  // telemetryEnabled should reject non-boolean
  try {
    await configManager.setValue('telemetryEnabled', 'yes');
    assert.fail('Should have thrown for non-boolean telemetryEnabled');
  } catch (e) {
    assert.ok(e.message.includes('boolean value'), `Error should mention boolean: ${e.message}`);
    console.log('✓ telemetryEnabled rejects non-boolean value');
  }
}

/**
 * Test 5: Null bytes stripped from commands
 */
async function testNullByteStripping() {
  console.log('\nTest 5: Null bytes stripped from commands');

  await configManager.setValue('blockedCommands', ['sudo']);

  // Command with null bytes trying to bypass blocklist
  // After sanitization, \0 becomes space, and ; still separates commands
  const malicious = 'echo foo\0;sudo rm -rf /';
  const result = await commandManager.validateCommand(malicious);
  assert.strictEqual(result, false, 'Command with null bytes should be blocked when containing blocked command');
  console.log('✓ Null byte injection blocked');
}

export default async function runTests() {
  let originalConfig;
  try {
    originalConfig = await setup();

    await testNewlineInjection();
    await testFailClosed();
    await testProtectedConfigKeys();
    await testConfigTypeValidation();
    await testNullByteStripping();

    console.log('\n✅ All security hardening tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    return false;
  } finally {
    if (originalConfig) {
      await teardown(originalConfig);
    }
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
