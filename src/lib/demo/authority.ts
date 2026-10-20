import { defaultCryptoProvider } from "@/lib/protocol";

/**
 * The lock authority key signs every lock. In production set KL_AUTHORITY_PRIVATE_KEY
 * (PKCS#8 hex) and KL_AUTHORITY_PUBLIC_KEY (raw hex); generate them with
 * `node scripts/generate-authority-key.mjs`. Locally a throwaway key is generated per process.
 */

interface AuthorityKey {
  privateKey: string;
  publicKey: string;
  ephemeral: boolean;
}

const g = globalThis as unknown as { __klAuthority?: Promise<AuthorityKey> };

export function getAuthorityKey(): Promise<AuthorityKey> {
  if (!g.__klAuthority) {
    const privateKey = process.env.KL_AUTHORITY_PRIVATE_KEY;
    const publicKey = process.env.KL_AUTHORITY_PUBLIC_KEY;
    if (privateKey && publicKey) {
      g.__klAuthority = Promise.resolve({ privateKey, publicKey, ephemeral: false });
    } else {
      if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
        console.warn(
          "[knowledge-lock] KL_AUTHORITY_* keys are not set. Using a throwaway key: locks will verify, but the signer changes on every restart."
        );
      }
      g.__klAuthority = defaultCryptoProvider
        .generateKeyPair()
        .then((k) => ({ ...k, ephemeral: true }));
    }
  }
  return g.__klAuthority;
}
