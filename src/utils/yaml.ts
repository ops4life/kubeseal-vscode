/**
 * YAML parsing and manipulation utilities
 */

import * as yaml from 'js-yaml';
import { KubernetesSecret, SealedSecret, SecretMetadata } from '../types/kubernetes';

/**
 * Parses YAML content and returns the parsed document
 * @param content YAML content as string
 * @returns Parsed YAML document
 */
export function parseYaml<T = unknown>(content: string): T {
    try {
        return yaml.load(content) as T;
    } catch (error) {
        throw new Error(`Failed to parse YAML: ${error}`);
    }
}

/**
 * Converts an object to YAML string
 * @param obj Object to convert
 * @returns YAML string
 */
export function toYaml(obj: unknown): string {
    return yaml.dump(obj, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
    });
}

/**
 * Checks if the YAML content contains a Kubernetes Secret
 * @param content YAML content as string
 * @returns true if content is a Secret
 */
export function isKubernetesSecret(content: string): boolean {
    try {
        const doc = parseYaml<{ kind?: string }>(content);
        return doc && doc.kind === 'Secret';
    } catch {
        return false;
    }
}

/**
 * Checks if the YAML content contains a SealedSecret
 * @param content YAML content as string
 * @returns true if content is a SealedSecret
 */
export function isSealedSecret(content: string): boolean {
    try {
        const doc = parseYaml<{ kind?: string }>(content);
        return doc && doc.kind === 'SealedSecret';
    } catch {
        return false;
    }
}

/**
 * Extracts metadata from a SealedSecret YAML
 * @param content SealedSecret YAML content
 * @returns Secret metadata (name and namespace)
 */
export function extractSecretMetadata(content: string): SecretMetadata {
    const doc = parseYaml<SealedSecret>(content);

    if (!doc.metadata?.name) {
        throw new Error('SealedSecret does not have a metadata.name field');
    }

    return {
        name: doc.metadata.name,
        namespace: doc.metadata.namespace || 'default'
    };
}

/**
 * Parses a Kubernetes Secret from YAML content
 * @param content YAML content
 * @returns Parsed Secret object
 */
export function parseSecret(content: string): KubernetesSecret {
    const doc = parseYaml<KubernetesSecret>(content);

    if (doc.kind !== 'Secret') {
        throw new Error('YAML document is not a Kubernetes Secret');
    }

    return doc;
}
