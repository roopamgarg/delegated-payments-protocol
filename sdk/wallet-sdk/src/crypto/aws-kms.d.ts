declare module '@aws-sdk/client-kms' {
  export class KMSClient {
    constructor(config?: object);
    send(command: unknown): Promise<{ Signature?: Uint8Array }>;
  }
  export class SignCommand {
    constructor(input: {
      KeyId: string;
      Message: Uint8Array;
      MessageType: 'DIGEST';
      SigningAlgorithm: 'ECDSA_SHA_256';
    });
  }
}
