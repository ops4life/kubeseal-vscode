/**
 * Validation utilities for Kubernetes resources and inputs
 */

import { SecretMetadata } from '../types/kubernetes';

/**
 * Validates if a string is a valid Kubernetes resource name
 * Must follow RFC 1123 DNS label standard
 */
export function isValidKubernetesName(name: string): boolean {
    if (!name || name.length === 0 || name.length > 253) {
        return false;
    }
    // RFC 1123 DNS label: lowercase alphanumeric or '-', must start/end with alphanumeric
    return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name);
}

/**
 * Validates secret metadata (name and namespace)
 * @throws Error if validation fails
 */
export function validateSecretMetadata(metadata: SecretMetadata): void {
    if (!isValidKubernetesName(metadata.name)) {
        throw new Error(
            `Invalid Kubernetes secret name: "${metadata.name}". Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric.`
        );
    }
    if (!isValidKubernetesName(metadata.namespace)) {
        throw new Error(
            `Invalid Kubernetes namespace: "${metadata.namespace}". Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric.`
        );
    }
}

/**
 * Checks if a value is likely base64 encoded
 */
export function isProbablyBase64Value(value: string): boolean {
    if (!value || value.length < 4) {
        return false;
    }

    // Base64 valid characters pattern
    const base64ValidCharsRegex = /^[A-Za-z0-9+/\-_]*={0,2}$/;
    if (!base64ValidCharsRegex.test(value)) {
        return false;
    }

    // Base64 strings should be multiples of 4 in length (with padding)
    if (value.length % 4 !== 0 && !value.includes('=')) {
        return false;
    }

    // Try to decode to verify it's valid base64
    try {
        Buffer.from(value, 'base64');
        return true;
    } catch {
        return false;
    }
}
