import { Context, Elysia, t } from "elysia";
import jwt from '@elysiajs/jwt';
import { octokitApp } from "./app";
import { Octokit } from "octokit";
import { GITHUB_AUTHENTICATION_STRATEGY_OPTIONS } from "../types";
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

async function checkIfTokenIsValid(token: string, set: Context["set"]) {
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

interface TokenVerifier {
    verify(bearer: string | undefined): Promise<any>;
}

export async function getJwtPayload<T extends TokenVerifier>(realm: T, bearer: string | undefined, set: Context["set"]) {
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

export async function resolveJwtPayload<T extends TokenVerifier>(realm: T, authorization: string | undefined, set: Context["set"]) {
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

function getFetchParams(jwt: any) {
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
