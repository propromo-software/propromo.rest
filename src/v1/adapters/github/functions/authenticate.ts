import { type Context, Elysia, t } from "elysia";
import jwt from '@elysiajs/jwt';
import { octokitApp } from "./app";
import { Octokit } from "octokit";
import { GITHUB_AUTHENTICATION_STRATEGY_OPTIONS } from "../types";
import bearer from '@elysiajs/bearer';
import { fetchGithubDataUsingGraphql } from "./fetch";
import type { RateLimit } from "@octokit/graphql-schema";
import { GITHUB_QUOTA } from "../graphql";
import { maybeStringToNumber } from "./parse";

/* JWT */

export const GITHUB_JWT_REALM = 'propromoRestAdaptersGithub';

export const GITHUB_JWT = new Elysia()
    .use(
        jwt({
            name: GITHUB_JWT_REALM,
            secret: process.env.JWT_SECRET!,
            alg: "HS256", /* alt: RS256 */
            iss: "propromo",
            schema: t.Object({
                auth_type: t.Enum(GITHUB_AUTHENTICATION_STRATEGY_OPTIONS),
                auth: t.Union([t.String(), t.Numeric()]) // token or installation_id
            })
        })
    )

export const RESOLVE_JWT = new Elysia()
    .use(GITHUB_JWT)
    .resolve({ as: "scoped" }, async ({ propromoRestAdaptersGithub, headers: { authorization }, set }) => {
        if (!authorization) { // Authorization: Bearer <token>
            set.status = 400;
            set.headers[
                'WWW-Authenticate'
            ] = `Bearer realm='${GITHUB_JWT_REALM}', error="bearer_token_missing"`;
        }
    
        const bearer = authorization?.split(' ')[1];
        if (!bearer || bearer.trim().length === 0) {
            set.status = 400;
            set.headers[
                'WWW-Authenticate'
            ] = `Bearer realm='${GITHUB_JWT_REALM}', error="bearer_token_missing"`;
        }

        const jwt = await propromoRestAdaptersGithub.verify(bearer);
        if (!jwt) {
            set.status = 401;
            set.headers[
                'WWW-Authenticate'
            ] = `Bearer realm='${GITHUB_JWT_REALM}', error="bearer_token_invalid"`;

            throw Error('Unauthorized. Authentication token is missing or invalid. Please provide a valid token. Tokens can be obtained from the `/auth/app|token` endpoints.');
        }

        if (!bearer) {
            set.status = 400
            set.headers[
                'WWW-Authenticate'
            ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`

            throw Error('Token is missing. Create one at https://github.com/settings/tokens.');
        }

        const tokenIsValid = await checkIfTokenIsValid(bearer, set);
        if (!tokenIsValid) {
            set.status = 401;
            set.headers[
                'WWW-Authenticate'
            ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;
    
            throw Error("Unauthorized");
        }

        return {
            fetchParams: {
                auth_type: jwt.auth_type,
                auth: jwt.auth
            }
        };
    })

/* APP AND TOKEN AUTHENTICATION */

async function checkIfTokenIsValid(token: string | number, set: Context["set"]) {
    const response = await fetchGithubDataUsingGraphql<{ rateLimit: RateLimit } | undefined | null>(
        GITHUB_QUOTA,
        token,
        set
    );

    if (!response.success || (response?.data === undefined)) {
        set.status = 401;
        set.headers[
            'WWW-Authenticate'
        ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;

        throw Error(`The provided token is invalid or has expired. Please try another token. Perhaps you chose the wrong provider? [${response?.error}]` ?? '');
    }

    return true;
}

export const GITHUB_APP_AUTHENTICATION = new Elysia({ prefix: '/auth' })
    .use(bearer())
    .use(GITHUB_JWT)
    .post('/app', async ({ body, propromoRestAdaptersGithub }) => {
        const auth = maybeStringToNumber(body?.installation_id!); // bearer is checked beforeHandle

        const bearerToken = await propromoRestAdaptersGithub.sign({
            auth_type: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.APP,
            auth,
            iat: Math.floor(Date.now() / 1000) - 60,
            /* exp: Math.floor(Date.now() / 1000) + (10 * 60) */
        })

        return bearerToken;
    }, {
        async beforeHandle({ body, set }) {
            if (!body.code || !body.installation_id || !body.setup_action || body.setup_action !== 'install') {
                set.status = 400;
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`;
    
                throw Error('App installation is missing. Install it at https://github.com/apps/propromo-software/installations/new.');
            }

            const tokenIsValid = await checkIfTokenIsValid(body.installation_id, set);
            if (!tokenIsValid) {
                set.status = 401;
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;
        
                throw Error("Unauthorized");
            }
        },
        body: t.Object({
            code: t.Optional(
                t.String({
                    minLength: 1
                }),
            ),
            installation_id: t.Optional(
                t.Numeric({
                    minLength: 1
                }),
            ),
            setup_action: t.Const("install")
        }),
        detail: {
            description: "Authenticate using a GitHub App.",
            tags: ['github', 'authentication']
        }
    })
    .post('/token', async ({ propromoRestAdaptersGithub, bearer }) => {
        const auth = maybeStringToNumber(bearer!); // bearer is checked beforeHandle

        const bearerToken = await propromoRestAdaptersGithub.sign({
            auth_type: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.TOKEN,
            auth
        })
    
        return bearerToken;
    }, {
        async beforeHandle({ bearer, set }) {
            if (!bearer) {
                set.status = 400
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`

                throw Error('Token is missing. Create one at https://github.com/settings/tokens.')
            }

            const tokenIsValid = await checkIfTokenIsValid(bearer, set);
            if (!tokenIsValid) {
                set.status = 401;
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;
        
                throw Error("Unauthorized");
            }
        },
        detail: {
            description: "Authenticate using a GitHub PAT.",
            tags: ['github', 'authentication']
        }
    })

/* APP */

/**
 * Generates an Octokit object based on the provided authentication strategy and credentials.
 * @documentation https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation#using-octokitjs-to-authenticate-with-an-installation-id
 */
export async function getOctokitObject(authStrategy: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null, auth: string | number | null): Promise<Octokit | null> {
    let octokitObject = null;

    if (typeof auth === "string" && (!authStrategy || authStrategy === GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.TOKEN)) {
        octokitObject = new Octokit({ auth });
    } else if (authStrategy === GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.APP) {
        octokitObject = await octokitApp.getInstallationOctokit(auth as number); // get Installation by installationId
    } else {
        return null;
    }

    return octokitObject;
}
