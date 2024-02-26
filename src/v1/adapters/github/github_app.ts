import jwt, { Secret } from 'jsonwebtoken';
import { App } from 'octokit';

const GITHUB_APP_ID = process.env.GITHUB_APP_ID as string;
const GITHUB_APP_PRIVATE_KEY = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY as String, 'utf-8').toString("utf-8");

export const octokitApp = new App({ // type: "installation"
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_APP_PRIVATE_KEY,
});

octokitApp.webhooks.onAny(async ({ id, name, payload }) => {
    console.log(id, name, 'event received');
    console.log("payload", payload);
});

/**
 * Generates a JSON Web Token (JWT) for authentication.  
 * @documentation https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 * @deprecated is handled by the octokit sdk
 * 
 * @return {string} The generated JWT for authentication.
 */
export function generateJwt(): string {
    const privatePem = GITHUB_APP_PRIVATE_KEY;
    const payload = {
        iat: Math.floor(Date.now() / 1000) - 60,
        exp: Math.floor(Date.now() / 1000) + (10 * 60),
        iss: process.env.GITHUB_APP_ID,
        alg: 'RS256'
    };

    const cert: Secret = {
        key: privatePem,
        passphrase: ''
    };

    return jwt.sign(payload, cert);
}
