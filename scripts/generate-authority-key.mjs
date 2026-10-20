// Generates the Ed25519 lock authority key pair. Run: node scripts/generate-authority-key.mjs
// Put both values in your environment (Vercel: Project Settings > Environment Variables).
const { subtle } = globalThis.crypto;
const hex = (buf) => "0x" + Buffer.from(buf).toString("hex");
const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
console.log(`KL_AUTHORITY_PRIVATE_KEY=${hex(await subtle.exportKey("pkcs8", pair.privateKey))}`);
console.log(`KL_AUTHORITY_PUBLIC_KEY=${hex(await subtle.exportKey("raw", pair.publicKey))}`);
