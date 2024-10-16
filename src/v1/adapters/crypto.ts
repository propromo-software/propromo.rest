import { PAT_SALT as SALT } from "../../environment";

/**
 * Encrypts a string using a password derived key.
 *
 * @param {string} plaintext - The string to encrypt.
 * @returns {Promise<string>} - The encrypted string.
 */
export async function encryptString(plaintext: string): Promise<string> {
	const plaintextBuffer = new TextEncoder().encode(plaintext);

	const passwordKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(SALT),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	const key = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: new TextEncoder().encode(SALT),
			iterations: 100000,
			hash: "SHA-256",
		},
		passwordKey,
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"],
	);

	const iv = crypto.getRandomValues(new Uint8Array(12));

	const encryptedBuffer = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: iv,
		},
		key,
		plaintextBuffer,
	);

	const encryptedString = btoa(
		String.fromCharCode.apply(null, Array.from(new Uint8Array(iv))) +
			String.fromCharCode.apply(
				null,
				Array.from(new Uint8Array(encryptedBuffer)),
			),
	);

	return encryptedString;
}

/**
 * Decrypts an encrypted string using a password derived key.
 *
 * @param {string} encryptedString - The encrypted string to decrypt.
 * @returns {Promise<string>} - The decrypted string.
 */
export async function decryptString(encryptedString: string): Promise<string> {
	console.log("encryptedString", encryptedString);

	const encryptedBuffer = Uint8Array.from(atob(encryptedString), (c) =>
		c.charCodeAt(0),
	);

	const iv = encryptedBuffer.slice(0, 12);
	const cipherText = encryptedBuffer.slice(12);

	const passwordKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(SALT),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	const key = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: new TextEncoder().encode(SALT),
			iterations: 100000,
			hash: "SHA-256",
		},
		passwordKey,
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"],
	);

	const decryptedBuffer = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv: iv,
		},
		key,
		cipherText,
	);

	const decryptedString = new TextDecoder().decode(decryptedBuffer);

	return decryptedString;
}
