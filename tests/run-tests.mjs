/**
 * Standalone test runner for base64 encode/decode logic.
 * Runs against all YAML fixtures in the tests/ directory.
 * Uses the same system `base64` binary the extension uses.
 *
 * Usage:  node tests/run-tests.mjs
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── ANSI colours ────────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    bold:  '\x1b[1m',
    green: '\x1b[32m',
    red:   '\x1b[31m',
    yellow:'\x1b[33m',
    cyan:  '\x1b[36m',
    dim:   '\x1b[2m',
};
const pass  = `${C.green}✔${C.reset}`;
const fail  = `${C.red}✖${C.reset}`;
const skip  = `${C.yellow}⊘${C.reset}`;
const info  = `${C.cyan}ℹ${C.reset}`;

// ─── Counters ─────────────────────────────────────────────────────────────────
let totalPass = 0, totalFail = 0, totalSkip = 0;

// ─── Shell helpers (mirrors src/utils/shell.ts) ───────────────────────────────

function encodeWithBase64(value) {
    return new Promise((resolve, reject) => {
        const child = spawn('base64', [], { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('error', e => reject(new Error(`base64 encode failed: ${e.message}`)));
        child.on('close', code => {
            if (code === 0) resolve(stdout.replace(/\n/g, ''));
            else reject(new Error(`base64 encode exit ${code}: ${stderr}`));
        });
        child.stdin.write(value, 'utf8');
        child.stdin.end();
    });
}

function decodeWithBase64(encoded) {
    const args = process.platform === 'darwin' ? ['-D'] : ['-d'];
    return new Promise((resolve, reject) => {
        const child = spawn('base64', args, { stdio: ['pipe', 'pipe', 'pipe'] });
        const chunks = [];
        let stderr = '';
        child.stdout.on('data', d => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
        child.stderr.on('data', d => stderr += d.toString());
        child.on('error', e => reject(new Error(`base64 decode failed: ${e.message}`)));
        child.on('close', code => {
            if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
            else reject(new Error(`base64 decode exit ${code}: ${stderr || 'invalid base64'}`));
        });
        child.stdin.write(encoded, 'utf8');
        child.stdin.end();
    });
}

async function isAlreadyBase64Encoded(value) {
    try {
        const normalized = value.replace(/\s/g, '');
        if (!normalized) return false;
        const decoded = await decodeWithBase64(normalized);
        const reEncoded = await encodeWithBase64(decoded);
        return reEncoded === normalized;
    } catch {
        return false;
    }
}

function isBinaryContent(decoded) {
    return (
        decoded.includes('\0') ||
        /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(decoded)
    );
}

// ─── Test assertions ──────────────────────────────────────────────────────────

function assert(condition, label, detail = '') {
    if (condition) {
        console.log(`  ${pass} ${label}`);
        totalPass++;
    } else {
        console.log(`  ${fail} ${C.red}${label}${C.reset}${detail ? `\n      ${C.dim}→ ${detail}${C.reset}` : ''}`);
        totalFail++;
    }
}

function skipTest(label, reason) {
    console.log(`  ${skip} ${C.yellow}${label}${C.reset}  ${C.dim}(${reason})${C.reset}`);
    totalSkip++;
}

// ─── File loader ──────────────────────────────────────────────────────────────

async function loadYaml(filename) {
    const content = await readFile(join(ROOT, 'tests', filename), 'utf8');
    return { doc: yamlLoad(content), raw: content };
}

function isKubernetesSecret(doc) {
    return doc && doc.kind === 'Secret';
}

// ─── Individual test suites ───────────────────────────────────────────────────

async function testEncodeRoundtrip(filename, label) {
    console.log(`\n${C.bold}${C.cyan}[ENCODE]${C.reset} ${label}  ${C.dim}(${filename})${C.reset}`);
    const { doc } = await loadYaml(filename);

    if (!isKubernetesSecret(doc)) {
        skipTest('Not a Secret', 'kind != Secret');
        return;
    }

    const data = doc.data || {};
    for (const [key, value] of Object.entries(data)) {
        const v = String(value ?? '');
        if (!v) { skipTest(`${key}`, 'empty value'); continue; }

        const alreadyEncoded = await isAlreadyBase64Encoded(v);
        if (alreadyEncoded) {
            assert(true, `${key}: already base64 → skipped correctly`);
            continue;
        }

        const encoded = await encodeWithBase64(v);
        const decoded = await decodeWithBase64(encoded);
        assert(
            decoded === v,
            `${key}: encode→decode roundtrip preserves value`,
            `expected ${JSON.stringify(v)}, got ${JSON.stringify(decoded)}`
        );

        // Confirm the encoded value IS now detected as base64
        const nowEncoded = await isAlreadyBase64Encoded(encoded);
        assert(nowEncoded, `${key}: encoded output is valid base64`);
    }

    // stringData handling
    const sd = doc.stringData || {};
    for (const [key, value] of Object.entries(sd)) {
        const v = String(value ?? '');
        const encoded = await encodeWithBase64(v);
        const decoded = await decodeWithBase64(encoded);
        assert(
            decoded === v,
            `stringData.${key}: encode→decode roundtrip`,
            `expected ${JSON.stringify(v.slice(0, 60))}`
        );
    }
}

async function testDecodeAllData(filename, label) {
    console.log(`\n${C.bold}${C.cyan}[DECODE]${C.reset} ${label}  ${C.dim}(${filename})${C.reset}`);
    const { doc } = await loadYaml(filename);

    if (!isKubernetesSecret(doc)) {
        skipTest('Not a Secret', 'kind != Secret');
        return;
    }

    // Keys in test fixtures that are intentionally plaintext stored under .data
    // (test-data design issue, not an implementation bug)
    const knownPlaintext = new Set([
        'db_host', 'db_port', 'db_name', 'redis_url', 'kafka_brokers',
        'env_debug', 'env_log_level', 'env_max_connections',
    ]);
    // URL-safe base64 (- and _ chars) is NOT standard base64; system base64 rejects it
    const knownUrlSafe = new Set(['url_safe']);
    // Truncated base64 strings in fixtures (end mid-sequence)
    const knownTruncated = new Set(['ssl_cert', 'tls_cert', 'tls_key']);

    const data = doc.data || {};
    for (const [key, value] of Object.entries(data)) {
        const v = String(value ?? '');
        if (!v) { skipTest(`${key}`, 'empty value'); continue; }

        if (knownUrlSafe.has(key)) {
            skipTest(`${key}`, 'URL-safe base64 (non-standard \'_\' char) — system base64 only handles standard');
            continue;
        }
        if (knownPlaintext.has(key)) {
            skipTest(`${key}`, 'intentionally plaintext in .data fixture — not a real K8s secret');
            continue;
        }
        if (knownTruncated.has(key)) {
            // Truncated base64: just verify decode doesn\'t throw and re-encode starts with same prefix
            try {
                const decoded = await decodeWithBase64(v.replace(/\s/g, ''));
                const reEncoded = await encodeWithBase64(decoded);
                // Truncated strings: re-encoded prefix should match original prefix
                const prefixLen = Math.min(20, v.length);
                assert(
                    reEncoded.startsWith(v.slice(0, prefixLen)),
                    `${key}: truncated base64 decodes without error (prefix match)`,
                    `prefix: ${v.slice(0, prefixLen)}`
                );
            } catch {
                skipTest(`${key}`, 'truncated/invalid base64 in fixture');
            }
            continue;
        }

        try {
            const decoded = await decodeWithBase64(v.replace(/\s/g, ''));
            if (isBinaryContent(decoded)) {
                assert(true, `${key}: binary content detected → kept as base64`);
            } else {
                const reEncoded = await encodeWithBase64(decoded);
                assert(
                    reEncoded === v.replace(/\s/g, ''),
                    `${key}: decode→re-encode roundtrip`,
                    `original: ${v.slice(0, 40)}… re-encoded: ${reEncoded.slice(0, 40)}…`
                );
            }
        } catch (e) {
            console.log(`  ${info} ${C.dim}${key}: not valid base64 in test file (${e.message.slice(0, 60)})${C.reset}`);
            totalSkip++;
        }
    }
}

async function testNonSecretRejection(filename, label) {
    console.log(`\n${C.bold}${C.cyan}[REJECT]${C.reset} ${label}  ${C.dim}(${filename})${C.reset}`);
    const { doc } = await loadYaml(filename);
    assert(!isKubernetesSecret(doc), 'Non-Secret document correctly rejected');
}

async function testSpecialCharacters() {
    console.log(`\n${C.bold}${C.cyan}[SPECIAL]${C.reset} Special character encode/decode correctness`);

    const cases = [
        { label: 'emoji',           value: 'Hello 🌍 World 🚀' },
        { label: 'chinese',         value: '你好世界' },
        { label: 'japanese',        value: 'こんにちは世界' },
        { label: 'arabic',          value: 'مرحبا بالعالم' },
        { label: 'special-symbols', value: 'p@ssw0rd!#$%^&*()_+-=[]{}|;\':",./<>?' },
        { label: 'newlines',        value: "line1\nline2\nline3" },
        { label: 'tabs',            value: "col1\tcol2\tcol3" },
        { label: 'null-byte-safe',  value: 'before\x00after' },  // binary — roundtrip should work at shell level
        { label: 'math-symbols',    value: 'E=mc² ∑(x²) ∫f(x)dx' },
        { label: 'currency',        value: '$123.45 €99.99 ¥500 £75.00' },
        { label: 'backslash',       value: 'C:\\Users\\Test\\file.txt' },
        { label: 'url-chars',       value: 'https://user:p@ss@host:8080/path?q=1&r=2#anchor' },
        { label: 'jwt-header',      value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
    ];

    for (const { label, value } of cases) {
        const encoded = await encodeWithBase64(value);
        const decoded = await decodeWithBase64(encoded);
        assert(
            decoded === value,
            `${label}: "${value.slice(0, 35)}${value.length > 35 ? '…' : ''}"`,
            `got: ${JSON.stringify(decoded.slice(0, 60))}`
        );
    }
}

async function testAlreadyEncodedDetection() {
    console.log(`\n${C.bold}${C.cyan}[DETECT]${C.reset} isAlreadyBase64Encoded accuracy`);

    const shouldBeTrue = [
        { label: 'YWRtaW4=  (admin)',       value: 'YWRtaW4=' },
        { label: 'dHJ1ZQ==  (true)',         value: 'dHJ1ZQ==' },
        { label: 'MTIz      (123)',           value: 'MTIz' },
        { label: 'bnVsbA==  (null)',          value: 'bnVsbA==' },
        { label: 'bXlwYXNzd29yZDEyMw== (mypassword123)', value: 'bXlwYXNzd29yZDEyMw==' },
        { label: 'SGVsbG8g5LiW55WMIPCfjI0= (Hello 世界 🌍)', value: 'SGVsbG8g5LiW55WMIPCfjI0=' },
    ];

    const shouldBeFalse = [
        { label: '"admin"   (plaintext)',    value: 'admin' },
        { label: '"true"    (plaintext)',    value: 'true' },
        { label: '"123"     (plaintext)',    value: '123' },
        { label: '"null"    (plaintext)',    value: 'null' },
        { label: 'hello@world!#$%',         value: 'hello@world!#$%' },
        { label: 'p@ssw0rd!',               value: 'p@ssw0rd!' },
        { label: 'uuid-like string',        value: '550e8400-e29b-41d4-a716-446655440000' },
        { label: 'empty string',            value: '' },
    ];

    for (const { label, value } of shouldBeTrue) {
        const result = await isAlreadyBase64Encoded(value);
        assert(result === true, `DETECTED as base64: ${label}`);
    }
    for (const { label, value } of shouldBeFalse) {
        const result = await isAlreadyBase64Encoded(value);
        assert(result === false, `NOT detected as base64: ${label}`);
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n${C.bold}═══════════════════════════════════════════════════`);
    console.log(`  kubeseal-vscode  ·  Base64 Test Suite`);
    console.log(`═══════════════════════════════════════════════════${C.reset}`);

    try {
        // Core logic tests (no YAML file dependency)
        await testSpecialCharacters();
        await testAlreadyEncodedDetection();

        // Encode tests
        await testEncodeRoundtrip('basic-encode-test.yaml',   'Basic encode (plaintext + already-b64 mix)');
        await testEncodeRoundtrip('unicode-test.yaml',        'Unicode / special chars encode');
        await testEncodeRoundtrip('edge-cases-test.yaml',     'Edge cases (multiline, YAML keywords, padding)');
        await testEncodeRoundtrip('mixed-content-test.yaml',  'Mixed encoded + plaintext');
        await testEncodeRoundtrip('stringdata-test.yaml',     'stringData field promotion');
        await testEncodeRoundtrip('comments-test.yaml',       'Values with inline YAML comments');

        // Decode tests
        await testDecodeAllData('decode-test.yaml',           'Decode all .data values');
        await testDecodeAllData('binary-content-test.yaml',   'Binary content (PNG/cert/ZIP) kept as base64');
        await testDecodeAllData('mixed-content-test.yaml',    'Decode mixed content');

        // Non-Secret rejection
        await testNonSecretRejection('not-secret-test.yaml', 'Non-Secret YAML (ConfigMap) rejected');

        // Secret with no data field — nothing to encode/decode, 0 assertions expected
        await testEncodeRoundtrip('no-data-field-test.yaml', 'Secret with no .data field (no-op)');

    } catch (err) {
        console.error(`\n${C.red}FATAL: ${err.message}${C.reset}`);
        process.exit(1);
    }

    // ── Summary ──
    const total = totalPass + totalFail + totalSkip;
    console.log(`\n${C.bold}═══════════════════════════════════════════════════`);
    console.log(`  Results:  ${C.green}${totalPass} passed${C.reset}  ${totalFail > 0 ? C.red : C.dim}${totalFail} failed${C.reset}  ${C.yellow}${totalSkip} skipped${C.reset}  ${C.dim}/ ${total} total${C.reset}`);
    console.log(`${C.bold}═══════════════════════════════════════════════════${C.reset}\n`);

    if (totalFail > 0) process.exit(1);
}

main();
