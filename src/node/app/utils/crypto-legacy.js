// src/node/app/utils/crypto-legacy.js
const crypto = require('crypto');

// MISMA clave que usa el PHP. Definila en tu .env como LEGACY_KEY="llave para encriptar"
const KEY_STRING = process.env.LEGACY_KEY;

if (!KEY_STRING) {
  // No tires el server: avisá en consola y seguí. (Podés cambiar a throw si preferís)
  console.warn('[crypto-legacy] WARNING: LEGACY_KEY no está definida en el .env');
}

/**
 * Cifra el ID de forma 100% compatible con el PHP legado:
 * - key = sha256(KEY_STRING) -> 32 bytes (AES-256)
 * - iv  = 16 bytes aleatorio
 * - cipher = AES-256-CBC
 * - retorno = base64( iv || cipherText )
 */
function encryptIdCompat(plainId) {
  if (!KEY_STRING) throw new Error('LEGACY_KEY no configurada');
  const key = crypto.createHash('sha256').update(KEY_STRING, 'utf8').digest(); // 32 bytes
  const iv  = crypto.randomBytes(16); // 16 bytes
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const buf = Buffer.concat([cipher.update(String(plainId), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, buf]).toString('base64');
}

/**
 * Des-cifra el id_encrypt (por si necesitás validar/debuguear)
 * base64 -> [iv(16)] [cipher] -> AES-256-CBC -> utf8
 */
function decryptIdCompat(idEncryptB64) {
  if (!KEY_STRING) throw new Error('LEGACY_KEY no configurada');
  const key = crypto.createHash('sha256').update(KEY_STRING, 'utf8').digest();
  const raw = Buffer.from(idEncryptB64, 'base64');
  const iv  = raw.subarray(0, 16);
  const ct  = raw.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString('utf8').replace(/\0+$/g, '');
}

function encryptIdCompatEtiqueta(plainId, secret) {
  const key = crypto.createHash('sha256').update(secret).digest(); 
  const iv = crypto.randomBytes(16);
  const block = 16;

  const buf = Buffer.from(String(plainId), 'utf8');
  const padLen = (block - (buf.length % block)) % block; 
  const padded = padLen === 0 ? buf : Buffer.concat([buf, Buffer.alloc(padLen, 0)]);

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false); 
  const enc = Buffer.concat([cipher.update(padded), cipher.final()]);

  return Buffer.concat([iv, enc]).toString('base64');
}



module.exports = { encryptIdCompat, decryptIdCompat, encryptIdCompatEtiqueta };
