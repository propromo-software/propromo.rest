import { Organization, Repository, User } from "@octokit/graphql-schema"; // https://www.npmjs.com/package/@octokit/graphql-schema
import { Context, Elysia, t } from "elysia"; // https://elysiajs.com/introduction.html
import {
    // PROJECT
    GITHUB_DEFAULT_PROJECT,
    GITHUB_PROJECT_INFO,
    GITHUB_PROJECT_REPOSITORIES,
    GITHUB_PROJECT_REPOSITORIES_AND_QUERY,
    GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY,

    // ORGANIZATION
    GITHUB_ORGANIZATION_BY_NAME,
    GITHUB_ORGANIZATION_REPOSITORY_BY_OWNER_NAME_AND_REPOSITORY_NAME,
    GITHUB_ORGANIZATION_PROJECT_BY_OWNER_NAME_AND_REPOSITORY_NAME_AND_PROJECT_NAME
} from "./github_graphql_queries";
import { fetchGithubDataUsingGraphql, validateViewParameter, parseMilestoneDepthAndIssueStates, parseScopedRepositories } from "./github_functions";
import { GITHUB_AUTHENTICATION_STRATEGY_OPTIONS, GITHUB_MILESTONES_DEPTH, GITHUB_MILESTONE_ISSUE_STATES, GITHUB_REPOSITORY_SCOPES } from "./github_types";
import { createPinoLogger } from '@bogeychan/elysia-logger'; // https://github.com/bogeychan/elysia-logger/issues/3
import bearer from '@elysiajs/bearer';
import { GITHUB_JWT, GITHUB_JWT_REALM } from "./github_globals";

const log = createPinoLogger();

const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_PROJECT_PARAMS = {
    login_name: t.String(),
    project_id: t.Numeric()
} as const;

const GITHUB_PROJECT_MILESTONE_PARAMS = {
    ...GITHUB_PROJECT_PARAMS,
    milestone_id: t.Numeric()
} as const;

const GITHUB_PROJECT_VIEWS_PARAMS = {
    ...GITHUB_PROJECT_PARAMS,
    project_view: t.Optional(t.String()) // t.Numeric({min: 0})
} as const;

const GITHUB_REPOSITORY_SCOPE_QUERY = {
    scope: t.String()
} as const;

const GITHUB_MILESTONE_QUERY = {
    depth: t.String(),
    issue_states: t.String(),
} as const;

/* GUARDED ENDPOINTS */

const guardEndpoints = (endpoints: Elysia) => new Elysia({
    name: 'guardEndpoints-plugin',
    seed: endpoints,
})
    .use(bearer())
    .use(GITHUB_JWT)
    .guard(
        {
            async beforeHandle({ bearer, set }) {
                if (!bearer) {
                    set.status = 400
                    set.headers[
                        'WWW-Authenticate'
                    ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`

                    return 'Unauthorized'
                }
            }
        },
        (app) => app
            .use(endpoints)
    );

/* APP WEBHOOK */

export const GITHUB_APP_WEBHOOK = new Elysia({ prefix: '/webhooks' })
    .post('', async (ctx) => {
        // notify the frontend about the changes
        // TODO: send the data to the frontend, or write it to the database
        const child = log.child({
            payload: ctx.body
        })
        child.info(ctx, "webhook received");

        return JSON.stringify(ctx.body, null, 2);
    }, {
        detail: {
            description: "",
            tags: ['github', 'webhooks']
        }
    });

/* APP AND TOKEN AUTHENTICATION */

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

        // TODO: test if app is valid at `propromo-software/demo`

        if (!bearerToken) {
            set.status = 401;
            set.headers[
                'WWW-Authenticate'
            ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;

            return 'Unauthorized';
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

            // TODO: test if token works at `propromo-software/demo`

            if (!bearerToken) {
                set.status = 401;
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_token"`;

                return 'Unauthorized';
            }

            return bearerToken;
        },
        detail: {
            description: "",
            tags: ['github', 'authentication']
        }
    });

/* TYPES (only the ones of the array properties, the rest can be found in /api/json) */

export const GITHUB_ARRAY_INPUT_TYPES = new Elysia({ prefix: '/input' })
    .get('/types', () => {
        const scopes = [];
        scopes.push({
            name: "GITHUB_REPOSITORY_SCOPES",
            description: "repository scopes",
            endpoint: "/github/orgs/{login_name}/projects/{project_id}/repositories/scoped?scope=<SCOPE>",
            type: Object.values(GITHUB_REPOSITORY_SCOPES)
        });
        scopes.push({
            name: "GITHUB_MILESTONES_DEPTH",
            description: "milestone scopes",
            endpoint: "/github/orgs/{login_name}/projects/{project_id}/repositories/milestones/{milestone_id}?depth=<DEPTH_1,DEPTH_2>&issue_states=<ISSUE_STATE_1,ISSUE_STATE_2>",
            type: Object.values(GITHUB_MILESTONES_DEPTH)
        })
        scopes.push({
            name: "GITHUB_MILESTONE_ISSUE_STATES",
            description: "issue scopes",
            endpoint: "/github/orgs/{login_name}/projects/{project_id}/repositories/milestones/{milestone_id}?depth=<DEPTH_1,DEPTH_2>&issue_states=<ISSUE_STATE_1,ISSUE_STATE_2>",
            type: Object.values(GITHUB_MILESTONE_ISSUE_STATES)
        })

        return scopes;
    }, {
        detail: {
            description: "No authentication needed. These are the types of the array properties used in the endpoints.",
            tags: ['github', 'types']
        }
    });

/* PROJECT */

/* <const Name extends string = "jwt", const Schema extends TSchema | undefined = undefined>({ name, secret, alg, crit, schema, nbf, exp, ...payload }: JWTOption<Name, Schema>) => Elysia<"", {
    request: { [name in Name extends string ? Name : "jwt"]: {
        readonly sign: (morePayload: UnwrapSchema<Schema, Record<string, string | number>> & JWTPayloadSpec) => Promise<string>;
        readonly verify: (jwt?: string) => Promise<false | (UnwrapSchema<Schema, Record<string, string | number>> & JWTPayloadSpec)>;
    }; } extends infer T ? { [K in keyof T]: { [name in Name extends string ? Name : "jwt"]: {
        readonly sign: (morePayload: UnwrapSchema<Schema, Record<string, string | number>> & JWTPayloadSpec) => Promise<string>;
        readonly verify: (jwt?: string) => Promise<false | (UnwrapSchema<Schema, Record<string, string | number>> & JWTPayloadSpec)>;
    }; }[K]; } : never;
    store: {};
    derive: {};
    resolve: {};
}, {
    type: {};
    error: {};
}, {}, {}, {}, false> */
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

async function resolveJwtPayload<T extends TokenVerifier>(realm: T, authorization: string | undefined, set: Context["set"]) {
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

export const GITHUB_ORGS = new Elysia({ prefix: '/orgs' })
    .use(guardEndpoints(new Elysia()
        .use(GITHUB_JWT)
        .resolve(async ({ propromoRestAdaptersGithub, headers: { authorization }, set }) => {
            return resolveJwtPayload<typeof propromoRestAdaptersGithub>(propromoRestAdaptersGithub, authorization, set);
        })
        .onBeforeHandle(({ fetchParams }) => {
            if (!fetchParams) return "Unauthorized. Authentication token is missing or invalid. Please provide a valid token. Tokens can be obtained from the `/auth/app|token` endpoints.";
        })
        .group("/:login_name/projects/:project_id", (app) => app
            .get('/infos', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_PROJECT_INFO(login_name, project_id),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github', 'projects']
                }
            })
            .get('/repositories', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_PROJECT_REPOSITORIES(login_name, project_id),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github', 'repositories']
                }
            })
            .get('/repositories/scoped', async ({ fetchParams, params: { login_name, project_id }, query, set }) => {
                const parsedScopes = parseScopedRepositories(query.scope, set);

                if (Array.isArray(parsedScopes)) {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        GITHUB_PROJECT_REPOSITORIES_AND_QUERY(login_name, project_id, parsedScopes),
                        fetchParams!.auth!,
                        set,
                        fetchParams!.auth_type!
                    );

                    return JSON.stringify(response, null, 2);
                } else {
                    return JSON.stringify(parsedScopes, null, 2);
                }
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                query: t.Object(GITHUB_REPOSITORY_SCOPE_QUERY),
                detail: {
                    description: "",
                    tags: ['github', 'repositories', 'scoped']
                }
            })
            .get('/repositories/milestones/:milestone_id', async ({ fetchParams, params: { login_name, project_id, milestone_id }, query, set }) => {
                const parsedDepthAndIssueStates = parseMilestoneDepthAndIssueStates(query.depth, query.issue_states, set);

                if ('depth' in parsedDepthAndIssueStates && 'issue_states' in parsedDepthAndIssueStates) {
                    const { depth, issue_states } = parsedDepthAndIssueStates;

                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY(login_name, project_id, milestone_id, depth, issue_states),
                        fetchParams!.auth!,
                        set,
                        fetchParams!.auth_type!
                    );

                    return JSON.stringify(response, null, 2);
                } else {
                    return JSON.stringify(parsedDepthAndIssueStates, null, 2);
                }
            }, {
                params: t.Object(GITHUB_PROJECT_MILESTONE_PARAMS),
                query: t.Object(GITHUB_MILESTONE_QUERY),
                detail: {
                    description: "",
                    tags: ['github', 'milestone', 'scoped']
                }
            })

            .get('', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_DEFAULT_PROJECT(login_name, project_id, -1),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github', 'projects']
                }
            })
            .get('/views/:project_view', async ({ fetchParams, params: { login_name, project_id, project_view }, set }) => {
                const view = validateViewParameter(project_view);

                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_DEFAULT_PROJECT(login_name, project_id, view),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object(GITHUB_PROJECT_VIEWS_PARAMS),
                detail: {
                    description: "`project_view` has to be greater than 0",
                    tags: ['github', 'views']
                }
            })
        )
    ));

export const GITHUB_USERS = new Elysia({ prefix: '/users' })
    .use(guardEndpoints(new Elysia()
        .use(GITHUB_JWT)
        .resolve(async ({ propromoRestAdaptersGithub, headers: { authorization }, set }) => {
            return resolveJwtPayload<typeof propromoRestAdaptersGithub>(propromoRestAdaptersGithub, authorization, set);
        })
        .onBeforeHandle(({ fetchParams }) => {
            if (!fetchParams) return "Unauthorized. Authentication token is missing or invalid. Please provide a valid token. Tokens can be obtained from the `/auth/app|token` endpoints.";
        })
        .group("/:login_name/projects/:project_id", (app) => app
            .get('/infos', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                    GITHUB_PROJECT_INFO(login_name, project_id, "user"),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github', 'projects']
                }
            })
            .get('/repositories', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                    GITHUB_PROJECT_REPOSITORIES(login_name, project_id, "user"),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github', 'repositories']
                }
            })
            .get('/repositories/scoped', async ({ fetchParams, params: { login_name, project_id }, query, set }) => {
                const parsedScopes = parseScopedRepositories(query.scope, set);

                if (Array.isArray(parsedScopes)) {
                    const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                        GITHUB_PROJECT_REPOSITORIES_AND_QUERY(login_name, project_id, parsedScopes, "user"),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return JSON.stringify(response, null, 2);
                } else {
                    return JSON.stringify(parsedScopes, null, 2);
                }
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                query: t.Object(GITHUB_REPOSITORY_SCOPE_QUERY),
                detail: {
                    description: "",
                    tags: ['github', 'repositories', 'scoped']
                }
            })
            .get('/repositories/milestones/:milestone_id', async ({ fetchParams, params: { login_name, project_id, milestone_id }, query, set }) => {
                const parsedDepthAndIssueStates = parseMilestoneDepthAndIssueStates(query.depth, query.issue_states, set);

                if ('depth' in parsedDepthAndIssueStates && 'issue_states' in parsedDepthAndIssueStates) {
                    const { depth, issue_states } = parsedDepthAndIssueStates;

                    const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                        GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY(login_name, project_id, milestone_id, depth, issue_states, "user"),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return JSON.stringify(response, null, 2);
                } else {
                    return JSON.stringify(parsedDepthAndIssueStates, null, 2);
                }
            }, {
                params: t.Object(GITHUB_PROJECT_MILESTONE_PARAMS),
                query: t.Object(GITHUB_MILESTONE_QUERY),
                detail: {
                    description: "",
                    tags: ['github', 'milestone', 'scoped']
                }
            })

            .get('', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                    GITHUB_DEFAULT_PROJECT(login_name, project_id, -1, "user"),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github', 'projects']
                }
            })
            .get('/views/:project_view', async ({ fetchParams, params: { login_name, project_id, project_view }, set }) => {
                const view = validateViewParameter(project_view);

                const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                    GITHUB_DEFAULT_PROJECT(login_name, project_id, view, "user"),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object(GITHUB_PROJECT_VIEWS_PARAMS),
                detail: {
                    description: "`project_view` has to be greater than 0",
                    tags: ['github', 'views']
                }
            }),
        )
    ));

/* ORGANIZATION (TESTING), no auth needed, just use the test token */

const GITHUB_ORGANIZATION = new Elysia({ prefix: '/organization' })
    .group("/:login_name", (app) => app
        .get('', async ({ params: { login_name }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_ORGANIZATION_BY_NAME(login_name),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object({
                login_name: t.String()
            }),
            detail: {
                description: "",
                tags: ['github', 'organization']
            }
        })
        .group("/repository/:repository_name", (app) => app
            .get('', async (
                { params: { login_name, repository_name }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ organization: Repository }>(
                    GITHUB_ORGANIZATION_REPOSITORY_BY_OWNER_NAME_AND_REPOSITORY_NAME(login_name, repository_name),
                    GITHUB_PAT,
                    set
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object({
                    login_name: t.String(),
                    repository_name: t.String()
                }),
                detail: {
                    description: "",
                    tags: ['github', 'organization']
                }
            })
            .get('/project/:project_name', async (
                { query, params: { login_name, repository_name, project_name }, set }) => {
                const view = validateViewParameter(String(query.view));

                const response = await fetchGithubDataUsingGraphql<{ repository: Repository }>(
                    GITHUB_ORGANIZATION_PROJECT_BY_OWNER_NAME_AND_REPOSITORY_NAME_AND_PROJECT_NAME(login_name, repository_name, project_name, view),
                    GITHUB_PAT,
                    set
                );

                return JSON.stringify(response, null, 2);
            }, {
                query: t.Object({
                    view: t.Optional(t.Numeric({
                        min: 0
                    }))
                }),
                params: t.Object({
                    login_name: t.String(),
                    repository_name: t.String(),
                    project_name: t.String()
                }),
                detail: {
                    description: "",
                    tags: ['github', 'organization']
                }
            })
        )
    );

/* INFO */

export const GITHUB_INFO = new Elysia({ prefix: '/info' })
    .use(GITHUB_ORGANIZATION)
