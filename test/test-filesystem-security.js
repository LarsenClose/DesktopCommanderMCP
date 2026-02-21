/**
 * Test script for filesystem security (SSRF protection)
 */

import assert from 'assert';

// Import the readFileFromUrl function
import { readFileFromUrl } from '../dist/tools/filesystem.js';

/**
 * Test 1: Reject file:// scheme
 */
async function testRejectFileScheme() {
  console.log('\nTest 1: readFileFromUrl rejects file:// scheme');

  try {
    await readFileFromUrl('file:///etc/passwd');
    assert.fail('Should have thrown for file:// URL');
  } catch (e) {
    assert.ok(
      e.message.includes('not allowed') || e.message.includes('scheme'),
      `Error should mention scheme restriction: ${e.message}`
    );
    console.log('✓ file:// scheme rejected');
  }
}

/**
 * Test 2: Reject localhost/loopback
 */
async function testRejectLocalhost() {
  console.log('\nTest 2: readFileFromUrl rejects http://127.0.0.1');

  try {
    await readFileFromUrl('http://127.0.0.1:8080/secret');
    assert.fail('Should have thrown for localhost URL');
  } catch (e) {
    assert.ok(
      e.message.includes('private') || e.message.includes('internal'),
      `Error should mention private/internal: ${e.message}`
    );
    console.log('✓ http://127.0.0.1 rejected');
  }
}

/**
 * Test 3: Reject metadata endpoint (169.254.x.x)
 */
async function testRejectMetadataEndpoint() {
  console.log('\nTest 3: readFileFromUrl rejects cloud metadata endpoint');

  try {
    await readFileFromUrl('http://169.254.169.254/latest/meta-data/');
    assert.fail('Should have thrown for metadata URL');
  } catch (e) {
    assert.ok(
      e.message.includes('private') || e.message.includes('internal'),
      `Error should mention private/internal: ${e.message}`
    );
    console.log('✓ http://169.254.169.254 rejected');
  }
}

/**
 * Test 4: Reject data: scheme
 */
async function testRejectDataScheme() {
  console.log('\nTest 4: readFileFromUrl rejects data: scheme');

  try {
    await readFileFromUrl('data:text/plain;base64,SGVsbG8=');
    assert.fail('Should have thrown for data: URL');
  } catch (e) {
    assert.ok(
      e.message.includes('not allowed') || e.message.includes('scheme'),
      `Error should mention scheme restriction: ${e.message}`
    );
    console.log('✓ data: scheme rejected');
  }
}

/**
 * Test 5: Reject ftp: scheme
 */
async function testRejectFtpScheme() {
  console.log('\nTest 5: readFileFromUrl rejects ftp: scheme');

  try {
    await readFileFromUrl('ftp://example.com/file.txt');
    assert.fail('Should have thrown for ftp: URL');
  } catch (e) {
    assert.ok(
      e.message.includes('not allowed') || e.message.includes('scheme'),
      `Error should mention scheme restriction: ${e.message}`
    );
    console.log('✓ ftp: scheme rejected');
  }
}

/**
 * Test 6: Reject 10.x.x.x (private range)
 */
async function testRejectPrivateRange() {
  console.log('\nTest 6: readFileFromUrl rejects 10.0.0.1');

  try {
    await readFileFromUrl('http://10.0.0.1/internal');
    assert.fail('Should have thrown for private IP URL');
  } catch (e) {
    assert.ok(
      e.message.includes('private') || e.message.includes('internal'),
      `Error should mention private/internal: ${e.message}`
    );
    console.log('✓ http://10.0.0.1 rejected');
  }
}

export default async function runTests() {
  try {
    await testRejectFileScheme();
    await testRejectLocalhost();
    await testRejectMetadataEndpoint();
    await testRejectDataScheme();
    await testRejectFtpScheme();
    await testRejectPrivateRange();

    console.log('\n✅ All filesystem security tests passed!');
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
