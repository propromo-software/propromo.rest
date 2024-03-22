import { Context, Elysia, t } from "elysia";
import jwt from '@elysiajs/jwt';
import { octokitApp } from "./app";
import { Octokit } from "octokit";
import { GITHUB_AUTHENTICATION_STRATEGY_OPTIONS, TokenVerifier } from "../types";
import bearer from '@elysiajs/bearer';
import { fetchGithubDataUsingGraphql } from "./fetch";
import { RateLimit } from "@octokit/graphql-schema";
import { GITHUB_QUOTA } from "../graphql";

/* JWT */

export const GITHUB_JWT_REALM = 'propromoRestAdaptersGithub';

export const GITHUB_JWT = new Elysia()
    .use(
        jwt({
            name: GITHUB_JWT_REALM,
            secret: process.env.JWT_SECRET!,
            alg: "HS256", /* alt: RS256 */
            iss: "propromo"
        })
    )

/* APP AND TOKEN AUTHENTICATION */

/**
 * Checks if the provided token is valid by fetching data from Github using GraphQL.
 *
 * @param {string} token - The token to check.
 * @param {Context["set"]} set - The set object from the context.
 * @return {Promise<boolean | string>} Returns true if the token is valid, otherwise returns an error message.
 */
async function checkIfTokenIsValid(token: string, set: Context["set"]): Promise<boolean | string> {
    const response = await fetchGithubDataUsingGraphql<{ rateLimit: RateLimit } | undefined | null>(
        GITHUB_QUOTA,
        token,
        set
    );

    if (!response.success || (response?.data == undefined)) {
        set.status = 401;
        set.headers[
            'WWW-Authenticate'
        ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;

        return 'The provided token is invalid or has expired. Please try another token. Perhaps you chose the wrong provider? ' + "[" + response?.error + "]" ?? '';
    } else {
        return true;
    }
}

export const GITHUB_APP_AUTHENTICATION = new Elysia({ prefix: '/auth' })
    .use(bearer())
    .use(GITHUB_JWT)
    .post('/app', async ({ set, body, propromoRestAdaptersGithub }) => {
        const code = body?.code
            ? body.code
            : null;
        const installation_id = body?.installation_id
            ? body.installation_id
            : null;
        const setup_action = body?.setup_action
            ? body.setup_action
            : null; // type=install

        if (!code || !installation_id || !setup_action || setup_action !== 'install') {
            set.status = 400;
            set.headers[
                'WWW-Authenticate'
            ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`;

            return 'Invalid request';
        }

        const bearerTokenPromise = propromoRestAdaptersGithub.sign({
            code: code,
            installation_id: installation_id,
            setup_action: setup_action,
            iat: Math.floor(Date.now() / 1000) - 60,
            /* exp: Math.floor(Date.now() / 1000) + (10 * 60) */
        })
        const bearerToken = await bearerTokenPromise;

        if (!bearerToken) {
            set.status = 401;
            set.headers[
                'WWW-Authenticate'
            ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;

            return 'Unauthorized';
        }

        const tokenIsValid = await checkIfTokenIsValid(bearerToken, set);

        if (typeof tokenIsValid === 'string') {
            return tokenIsValid;
        }

        return bearerToken;
    }, {
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
            description: "",
            tags: ['github', 'authentication']
        }
    })
    .post('/token', async ({ bearer }) => bearer, {
        async beforeHandle({ propromoRestAdaptersGithub, bearer, set }) {
            const token = bearer;

            if (!token) {
                set.status = 400
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`

                return 'Invalid request'
            }

            const bearerTokenPromise = propromoRestAdaptersGithub.sign({
                token: token
            })
            const bearerToken = await bearerTokenPromise;

            if (!bearerToken) {
                set.status = 401;
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;

                return 'Unauthorized';
            }

            const tokenIsValid = await checkIfTokenIsValid(token, set);

            if (typeof tokenIsValid === 'string') {
                return tokenIsValid;
            }

            return bearerToken;
        },
        detail: {
            description: "",
            tags: ['github', 'authentication']
        }
    });

/**
 * Retrieves the payload from the given token verifier and sets the status and headers if the payload is invalid. Returns the payload if it is valid, or 'Unauthorized' if it is invalid.
 *
 * @param {T} realm - The token verifier instance.
 * @param {string | undefined} bearer - The bearer token to verify.
 * @param {Context["set"]} set - The set function from the context.
 * @return {Promise<{payload: any}> | string} - Returns the payload if it is valid, or 'Unauthorized' if it is invalid.
 */
export async function getJwtPayload<T extends TokenVerifier>(realm: T, bearer: string | undefined, set: Context["set"]): Promise<string | { payload: any; }> {
    const payloadPromise = realm.verify(bearer);
    const payload = await payloadPromise;

    if (!payload) {
        set.status = 401;
        set.headers[
            'WWW-Authenticate'
        ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;

        return 'Unauthorized'
    }

    return {
        payload: payload
    }
}

/**
 * Resolves the JWT payload for the given token verifier.
 *
 * @param {T} realm - The token verifier.
 * @param {string | undefined} authorization - The authorization header value.
 * @param {Context["set"]} set - The set function from the context.
 * @return {Promise<{ fetchParams: { [key: string]: string }; } | { payload: null } | null>} - The resolved JWT payload or null if there was an error.
 */
export async function resolveJwtPayload<T extends TokenVerifier>(realm: T, authorization: string | undefined, set: Context["set"]): Promise<{ fetchParams: { [key: string]: string; }; } | { payload: null; } | null> {
    if (!authorization) {
        set.status = 400;
        set.headers[
            'WWW-Authenticate'
        ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`;

        return {
            payload: null
        }
    }

    const bearer = authorization?.split(' ')[1]; // Authorization: Bearer <token>
    const jwt = await getJwtPayload<typeof realm>(realm, bearer, set);
    if (typeof jwt === 'string') {
        return null;
    }

    return {
        fetchParams: {
            ...getFetchParams(jwt)
        }
    }
}

/**
 * Generate fetch parameters based on the JWT payload.
 *
 * @param {any} jwt - the JWT payload
 * @return {Object} object containing auth_type and auth
 */
function getFetchParams(jwt: any): object {
    const auth_type = jwt?.payload?.token ? GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.TOKEN : GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.APP;
    const installation_id: number = jwt?.payload?.installation_id;
    const token: string = jwt?.payload?.token;
    const auth = auth_type === GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.APP && installation_id ? installation_id : token;

    return {
        auth_type,
        auth
    };
}

/* APP */

/**
 * Generates an Octokit object based on the provided authentication strategy and credentials.
 * @documentation https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation#using-octokitjs-to-authenticate-with-an-installation-id
 *
 * @param {GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null} authStrategy - The authentication strategy options or null
 * @param {string | null} auth - The authentication token or null
 * @return {Octokit | null} The Octokit object or null
 */
export async function getOctokitObject(authStrategy: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null = null, auth: string | number | null): Promise<Octokit | null> {
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
