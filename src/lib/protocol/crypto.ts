/**
 * Pluggable Cryptographic Provider Interface & Default WebCrypto Provider
 * Compatible with Node.js (v18+), Browsers, Next.js Edge, and Cloudflare Workers.
 */

export interface CryptoProvider {
  name: string;
  sha256(data: string | Uint8Array): Promise<string>;
  generateKeyPair(): Promise<{ publicKey: string; privateKey: string }>;
  sign(data: string | Uint8Array, privateKey: string): Promise<string>;
  verify(data: string | Uint8Array, signatureHex: string, publicKeyHex: string): Promise<boolean>;
}

/**
 * Convert buffer to lowercase hex string
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBuffer(hex: string): Uint8Array {
  const cleanedHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const match = cleanedHex.match(/.{1,2}/g) || [];
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}

/**
 * Standard WebCrypto-based implementation using Ed25519 & SHA-256
 */
export class WebCryptoProvider implements CryptoProvider {
  public readonly name = "WebCrypto-Ed25519";

  private get subtle(): SubtleCrypto {
    if (typeof globalThis.crypto?.subtle !== "undefined") {
      return globalThis.crypto.subtle;
    }
    throw new Error("WebCrypto SubtleCrypto is not available in this environment.");
  }

  async sha256(data: string | Uint8Array): Promise<string> {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const digest = await this.subtle.digest("SHA-256", bytes as unknown as BufferSource);
    return `0x${bufferToHex(digest)}`;
  }

  async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    const keyPair = (await this.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"]
    )) as CryptoKeyPair;

    const pubExport = await this.subtle.exportKey("raw", keyPair.publicKey);
    const privExport = await this.subtle.exportKey("pkcs8", keyPair.privateKey);

    return {
      publicKey: `0x${bufferToHex(pubExport)}`,
      privateKey: `0x${bufferToHex(privExport)}`,
    };
  }

  async sign(data: string | Uint8Array, privateKeyHex: string): Promise<string> {
    const privBytes = hexToBuffer(privateKeyHex);
    const key = await this.subtle.importKey(
      "pkcs8",
      privBytes as unknown as BufferSource,
      { name: "Ed25519" },
      false,
      ["sign"]
    );

    const messageBytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const signature = await this.subtle.sign(
      { name: "Ed25519" },
      key,
      messageBytes as unknown as BufferSource
    );
    return `0x${bufferToHex(signature)}`;
  }

  async verify(
    data: string | Uint8Array,
    signatureHex: string,
    publicKeyHex: string
  ): Promise<boolean> {
    try {
      const pubBytes = hexToBuffer(publicKeyHex);
      const sigBytes = hexToBuffer(signatureHex);
      const key = await this.subtle.importKey(
        "raw",
        pubBytes as unknown as BufferSource,
        { name: "Ed25519" },
        false,
        ["verify"]
      );

      const messageBytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      return await this.subtle.verify(
        { name: "Ed25519" },
        key,
        sigBytes as unknown as BufferSource,
        messageBytes as unknown as BufferSource
      );
    } catch {
      return false;
    }
  }
}

export const defaultCryptoProvider = new WebCryptoProvider();
