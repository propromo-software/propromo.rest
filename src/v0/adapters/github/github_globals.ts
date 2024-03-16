import { Elysia } from "elysia"; // https://elysiajs.com/introduction.html
import jwt from '@elysiajs/jwt'; // https://elysiajs.com/plugins/jwt

export const GITHUB_API_HEADERS = {
    "X-GitHub-Api-Version": "2022-11-28"
}

export const GITHUB_JWT_REALM = 'propromoRestAdaptersGithub'

/* JWT */

export const GITHUB_JWT = new Elysia()
    .use(
        jwt({
            name: GITHUB_JWT_REALM,
            secret: process.env.JWT_SECRET!,
            alg: "HS256", /* alt: RS256 */
            iss: "propromo"
        })
    )
