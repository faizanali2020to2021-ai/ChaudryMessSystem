const crypto = require('crypto');

const ITERATIONS = 120000;
const KEY_LENGTH = 32; // 256 bits

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hash(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  return derivedKey.toString('hex');
}

function verify(password, saltHex, expectedHash) {
  return hash(password, saltHex) === expectedHash;
}

module.exports = {
  generateSalt,
  hash,
  verify
};
