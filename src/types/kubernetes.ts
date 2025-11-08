/**
 * Type definitions for Kubernetes resources
 */

export interface KubernetesMetadata {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
}

export interface KubernetesSecret {
    apiVersion: string;
    kind: 'Secret';
    metadata: KubernetesMetadata;
    data?: Record<string, string>;
    stringData?: Record<string, string>;
    type?: string;
}

export interface SealedSecret {
    apiVersion: string;
    kind: 'SealedSecret';
    metadata: KubernetesMetadata;
    spec: {
        encryptedData: Record<string, string>;
        template?: {
            metadata?: KubernetesMetadata;
            type?: string;
        };
    };
}

export interface SecretMetadata {
    name: string;
    namespace: string;
}
