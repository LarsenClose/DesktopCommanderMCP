/**
 * Test script for code quality fixes
 */

import assert from 'assert';

/**
 * Test 1: withTimeout rejects with Error instance on timeout
 */
async function testWithTimeoutRejectsError() {
  console.log('\nTest 1: withTimeout rejects with Error instance');

  const { withTimeout } = await import('../dist/utils/withTimeout.js');

  // Create a promise that never resolves
  const neverResolves = new Promise(() => {});

  try {
    await withTimeout(neverResolves, 100, 'test operation', null);
    assert.fail('Should have rejected');
  } catch (error) {
    assert.ok(error instanceof Error, `Should reject with Error instance, got: ${typeof error}`);
    assert.ok(
      error.message.includes('timed out'),
      `Error message should mention timeout: ${error.message}`
    );
    assert.ok(
      error.message.includes('0.1 seconds'),
      `Error message should include duration: ${error.message}`
    );
    console.log('✓ withTimeout rejects with proper Error instance');
  }
}

/**
 * Test 2: withTimeout error does NOT contain __ERROR__ prefix
 */
async function testWithTimeoutNoPrefix() {
  console.log('\nTest 2: withTimeout error has no __ERROR__ prefix');

  const { withTimeout } = await import('../dist/utils/withTimeout.js');

  const neverResolves = new Promise(() => {});

  try {
    await withTimeout(neverResolves, 100, 'test op', null);
    assert.fail('Should have rejected');
  } catch (error) {
    const errorStr = error instanceof Error ? error.message : String(error);
    assert.ok(
      !errorStr.includes('__ERROR__'),
      `Error should not contain __ERROR__ prefix: ${errorStr}`
    );
    console.log('✓ withTimeout error has clean format');
  }
}

/**
 * Test 3: withTimeout resolves with default value (non-null) on timeout
 */
async function testWithTimeoutDefaultValue() {
  console.log('\nTest 3: withTimeout resolves with default value on timeout');

  const { withTimeout } = await import('../dist/utils/withTimeout.js');

  const neverResolves = new Promise(() => {});
  const defaultVal = 'fallback';

  const result = await withTimeout(neverResolves, 100, 'test op', defaultVal);
  assert.strictEqual(result, defaultVal, 'Should resolve with default value');
  console.log('✓ withTimeout returns default value on timeout');
}

/**
 * Test 4: Message buffer cap exists in custom-stdio.ts
 */
async function testMessageBufferCap() {
  console.log('\nTest 4: Message buffer cap exists');

  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const source = await fs.readFile(
    path.join(__dirname, '..', 'src', 'custom-stdio.ts'),
    'utf-8'
  );

  assert.ok(
    source.includes('MAX_BUFFER'),
    'custom-stdio.ts should define MAX_BUFFER constant'
  );
  assert.ok(
    source.includes('MAX_BUFFER') && source.includes('1000'),
    'MAX_BUFFER should be set to 1000'
  );

  // Verify the cap is checked before pushing
  const pushCount = (source.match(/messageBuffer\.push/g) || []).length;
  const capCheckCount = (source.match(/messageBuffer\.length\s*<\s*FilteredStdioServerTransport\.MAX_BUFFER/g) || []).length;

  assert.ok(
    capCheckCount > 0,
    `Should have buffer cap checks, found ${capCheckCount}`
  );

  console.log(`✓ Message buffer cap exists (${capCheckCount} cap checks for ${pushCount} push sites)`);
}

/**
 * Test 5: Empty catches have debug logging
 */
async function testEmptyCatchesHaveLogging() {
  console.log('\nTest 5: Critical empty catches have debug logging');

  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Check search-manager.ts
  const searchSource = await fs.readFile(
    path.join(__dirname, '..', 'src', 'search-manager.ts'),
    'utf-8'
  );

  // Count empty catch blocks (catch { } or catch { /* ... */ })
  const emptyCatches = searchSource.match(/catch\s*\{[\s/\*]*\}/g) || [];
  assert.strictEqual(
    emptyCatches.length,
    0,
    `search-manager.ts should have no empty catch blocks, found ${emptyCatches.length}: ${emptyCatches.join(', ')}`
  );

  // Check toolHistory.ts
  const historySource = await fs.readFile(
    path.join(__dirname, '..', 'src', 'utils', 'toolHistory.ts'),
    'utf-8'
  );

  const historyEmptyCatches = historySource.match(/catch\s*\([^)]*\)\s*\{[\s/\*]*\}/g) || [];
  assert.strictEqual(
    historyEmptyCatches.length,
    0,
    `toolHistory.ts should have no empty catch blocks, found ${historyEmptyCatches.length}`
  );

  console.log('✓ No empty catch blocks in critical files');
}

export default async function runTests() {
  try {
    await testWithTimeoutRejectsError();
    await testWithTimeoutNoPrefix();
    await testWithTimeoutDefaultValue();
    await testMessageBufferCap();
    await testEmptyCatchesHaveLogging();

    console.log('\n All code quality tests passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    return false;
  }
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
