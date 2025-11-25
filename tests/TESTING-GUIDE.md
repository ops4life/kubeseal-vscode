# Testing Guide for Base64 Encode/Decode

This guide helps you test the base64 encoding and decoding functionality of the Kubeseal VS Code extension.

## Test Files Overview

### 1. `basic-encode-test.yaml`
**Purpose:** Test basic encoding of plain text values

**Test Steps:**
1. Open `basic-encode-test.yaml`
2. Right-click → "Kubeseal: Encode Base64"
3. **Expected Results:**
   - `username: admin` → `username: YWRtaW4=`
   - `password: mypassword123` → `password: bXlwYXNzd29yZDEyMw==`
   - `email: user@example.com` → `email: dXNlckBleGFtcGxlLmNvbQ==`
   - `special_chars: hello@world!#$%` → `special_chars: aGVsbG9Ad29ybGQhIyQl`
   - `unicode_text: Hello 世界 🌍` → `unicode_text: SGVsbG8g5LiW55WMIPCfjI0=`
   - Already encoded values (`token`, `apikey`) should remain unchanged

### 2. `decode-test.yaml`
**Purpose:** Test decoding of base64 values, including Unicode

**Test Steps:**
1. Open `decode-test.yaml`
2. Right-click → "Kubeseal: Decode Base64"
3. **Expected Results:**
   - `username: YWRtaW4=` → `username: admin`
   - `unicode_text: SGVsbG8g5LiW55WMIPCfjI0=` → `unicode_text: 'Hello 世界 🌍'`
   - `yaml_true: dHJ1ZQ==` → `yaml_true: 'true'`
   - `config_file` → should decode to multiline configuration
   - `json_config` → should decode to readable JSON
   - `binary_data` (PNG image) → **should stay as base64** (not decoded)

### 3. `unicode-test.yaml`
**Purpose:** Test Unicode characters and special characters encoding

**Test Steps:**
1. Open `unicode-test.yaml`
2. Right-click → "Kubeseal: Encode Base64"
3. **Expected Results:**
   - Chinese text: `你好世界` → `5L2g5aW95LiW55WM`
   - Japanese text: `こんにちは世界` → `44GT44KT44Gr44Gh44Gv5LiW55WM`
   - Arabic text → encoded correctly
   - Emoji text → encoded correctly
   - Already encoded values (`encoded_chinese`, `encoded_japanese`, `jwt_payload`) should remain unchanged

### 4. `binary-content-test.yaml`
**Purpose:** Test binary detection to prevent decoding binary content

**Test Steps:**
1. Open `binary-content-test.yaml`
2. Right-click → "Kubeseal: Decode Base64"
3. **Expected Results:**
   - `tiny_png` (PNG image) → **should stay as base64** (BINARY detected)
   - `ssl_cert` (PEM certificate) → **should be decoded** (TEXT)
   - `zip_data` (ZIP file) → **should stay as base64** (BINARY detected)
   - `jpeg_header` (JPEG file) → **should stay as base64** (BINARY detected)
   - `readme_content` → **should be decoded** to readable text
   - `config_json` → **should be decoded** to readable JSON

## Key Improvements in This Version

### ✅ Unicode Support
The new implementation properly supports Unicode characters:
- Chinese, Japanese, Arabic, Hebrew, etc.
- Emojis and special symbols
- Mathematical symbols (∑, ∫, ², etc.)
- Currency symbols (€, ¥, £, etc.)

### ✅ Binary Detection
The new binary detection algorithm:
- Checks for null bytes (`\0`)
- Looks for control characters (except tab, newline, carriage return)
- Does NOT incorrectly identify Unicode as binary

### ✅ What Gets Decoded
- Plain text (ASCII and Unicode)
- JSON configurations
- YAML configurations
- PEM certificates
- Any human-readable text content

### ✅ What Stays as Base64
- PNG, JPEG, GIF images
- ZIP, TAR archives
- Binary executables
- Any content with null bytes or binary control characters

## Manual Verification

You can manually verify base64 encoding/decoding:

### Encode
```bash
echo -n "Hello 世界 🌍" | base64
# Output: SGVsbG8g5LiW55WMIPCfjI0=
```

### Decode
```bash
echo "SGVsbG8g5LiW55WMIPCfjI0=" | base64 -d
# Output: Hello 世界 🌍
```

## Common Issues and Solutions

### Issue: Unicode text not decoding
**Solution:** This was the bug that has been fixed! Unicode should now decode properly.

### Issue: Images getting corrupted
**Solution:** Binary detection now properly identifies images and keeps them as base64.

### Issue: YAML keywords (true, false, null) becoming unquoted
**Solution:** After decoding, these values may need manual quoting in YAML.

## Edge Cases Tested

1. **Empty values** - handled gracefully
2. **Very long base64 strings** - processed correctly
3. **Base64 with no padding** - detected and handled
4. **Base64 with special characters** - processed correctly
5. **Multiline content** - encoded/decoded properly
6. **Mixed content files** - each value handled individually
