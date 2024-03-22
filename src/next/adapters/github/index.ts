// @ts-nocheck (weird errors, after upgrading to Elysia v1.0)
import { Organization, RateLimit, Repository, User } from "@octokit/graphql-schema";
import { Elysia, t } from "elysia";
import {
    GITHUB_DEFAULT_PROJECT,
    GITHUB_ORGANIZATION_BY_NAME,
    GITHUB_ORGANIZATION_PROJECT_BY_OWNER_NAME_AND_REPOSITORY_NAME_AND_PROJECT_NAME,
    GITHUB_ORGANIZATION_REPOSITORY_BY_OWNER_NAME_AND_REPOSITORY_NAME,
    GITHUB_PROJECT_INFO,
    GITHUB_PROJECT_REPOSITORIES,
    GITHUB_PROJECT_REPOSITORIES_AND_QUERY,
    GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY,
    GITHUB_QUOTA
} from "./graphql";
import { GITHUB_REPOSITORY_PARAMS, GITHUB_MILESTONE_PARAMS, GITHUB_ORGANIZATION_PARAMS } from "./params";
import { parseScopes, parsePageSizes, validateViewParameter } from "./functions/parse";
import { fetchGithubDataUsingGraphql, fetchRateLimit } from "./functions/fetch";
import { GITHUB_ORGANIZATION_SCOPES, GITHUB_REPOSITORY_SCOPES, GITHUB_MILESTONES_DEPTH, GITHUB_MILESTONE_ISSUE_STATES } from "./types";
import { createPinoLogger } from '@bogeychan/elysia-logger';
import { GITHUB_JWT, resolveJwtPayload } from "./functions/authenticate";
import { guardEndpoints } from "./plugins";

const log = createPinoLogger();
// const GITHUB_PAT = process.env.GITHUB_PAT; // TODO: multiple tokens like this token;token;token... for key rotation for public repositories, if user didn't provide a token

const GITHUB_PROJECT_PARAMS = {
    login_name: t.String(),
    project_id: t.Numeric()
} as const;

const GITHUB_PROJECT_MILESTONE_PARAMS = {
    ...GITHUB_PROJECT_PARAMS,
    milestone_id: t.Numeric()
} as const;

const GITHUB_REPOSITORY_SCOPE_QUERY = {
    scope: t.String()
} as const;

const GITHUB_MILESTONE_QUERY = {
    depth: t.String(),
    issue_states: t.String(),
} as const;

/* APP WEBHOOK */

export const GITHUB_APP_WEBHOOKS = new Elysia({ prefix: '/webhooks' })
    .post('', async (ctx) => {
        // TODO: notify the frontend about the changes

        const child = log.child({
            payload: ctx.body
        })
        child.info(ctx, "webhook received");

        return ctx.body;
    }, {
        detail: {
            description: "",
            tags: ['github', 'webhooks']
        }
    });

/* GENERAL */
export const GITHUB_GENERAL = new Elysia({ prefix: '/info' })
    .use(guardEndpoints(new Elysia()
        .use(GITHUB_JWT)
        .resolve(async ({ propromoRestAdaptersGithub, headers: { authorization }, set }) => {
            return resolveJwtPayload<typeof propromoRestAdaptersGithub>(propromoRestAdaptersGithub, authorization, set);
        })
        .onBeforeHandle(({ fetchParams }) => {
            if (!fetchParams) return "Unauthorized. Authentication token is missing or invalid. Please provide a valid token. Tokens can be obtained from the `/auth/app|token` endpoints.";
        })
        .group("/quota", (app) => app
            .get('/', async ({ fetchParams, set }) => {
                const response = await fetchRateLimit(
                    fetchParams!.auth,
                    set
                );

                return response;
            }, {
                detail: {
                    description: "",
                    tags: ['github']
                }
            })
            .get('/graphql', async ({ fetchParams, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ rateLimit: RateLimit } | undefined | null>(
                    GITHUB_QUOTA,
                    fetchParams!.auth,
                    set
                );

                const quota = response?.data?.rateLimit;

                return quota;
            }, {
                detail: {
                    description: "",
                    tags: ['github']
                }
            })
        )
    ));


/* PROJECT */

export const GITHUB_ORGS = new Elysia({ prefix: '/orgs' })
    .use(guardEndpoints(new Elysia()
        .use(GITHUB_JWT)
        .resolve(async ({ propromoRestAdaptersGithub, headers: { authorization }, set }) => {
            return resolveJwtPayload<typeof propromoRestAdaptersGithub>(propromoRestAdaptersGithub, authorization, set);
        })
        .onBeforeHandle(({ fetchParams }) => {
            if (!fetchParams) return "Unauthorized. Authentication token is missing or invalid. Please provide a valid token. Tokens can be obtained from the `/auth/app|token` endpoints.";
        })
        .group("/info/:login_name", (app) => app // TODO: add types and info to description (improve the other descriptions too), test all endpoints
            .get('', async ({ fetchParams, params: { login_name }, set, query }) => {
                // Why two different query parameters? Because typing and parsing something like ?scope=<scope>(filter=xxx,pageSize=xxx...) is too much of a pain.
                const parsedScopes = parseScopes<GITHUB_ORGANIZATION_SCOPES>(query?.scope, GITHUB_ORGANIZATION_SCOPES, set);
                const parsedPageSizes = parsePageSizes<GITHUB_ORGANIZATION_SCOPES>(query?.page, parsedScopes, set);

                if (Array.isArray(parsedScopes)) {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        GITHUB_ORGANIZATION_BY_NAME(login_name, parsedScopes, parsedPageSizes),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    set.status = 200;
                    return response;
                } else {
                    return parsedScopes;
                }
            }, {
                params: t.Object({
                    login_name: t.String()
                }),
                query: t.Object({
                    scope: t.Optional(t.String()),
                    page: t.Optional(t.String())
                }),
                detail: {
                    description: GITHUB_ORGANIZATION_PARAMS,
                    tags: ['github']
                }
            })
            .group("/repositories/:repository_name", (app) => app
                .get('', async (
                    { fetchParams, params: { login_name, repository_name }, set }) => {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Repository }>(
                        GITHUB_ORGANIZATION_REPOSITORY_BY_OWNER_NAME_AND_REPOSITORY_NAME(login_name, repository_name),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                }, {
                    params: t.Object({
                        login_name: t.String(),
                        repository_name: t.String()
                    }),
                    detail: {
                        description: "",
                        tags: ['github']
                    }
                })
                .get('/projects/:project_name', async (
                    { fetchParams, query, params: { login_name, repository_name, project_name }, set }) => {
                    const view = validateViewParameter(String(query.view));

                    const response = await fetchGithubDataUsingGraphql<{ repository: Repository }>(
                        GITHUB_ORGANIZATION_PROJECT_BY_OWNER_NAME_AND_REPOSITORY_NAME_AND_PROJECT_NAME(login_name, repository_name, project_name, view),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
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
                        tags: ['github']
                    }
                })
            )
        )
        .group("/:login_name/projects/:project_id", (app) => app
            .get('/infos', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_PROJECT_INFO(login_name, project_id),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return response;
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github']
                }
            })
            .get('/repositories', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_PROJECT_REPOSITORIES(login_name, project_id),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return response;
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github']
                }
            })
            .get('/repositories/scoped', async ({ fetchParams, params: { login_name, project_id }, query, set }) => {
                const parsedScopes = parseScopes<GITHUB_REPOSITORY_SCOPES>(query.scope, GITHUB_REPOSITORY_SCOPES, set);

                if (Array.isArray(parsedScopes)) {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        GITHUB_PROJECT_REPOSITORIES_AND_QUERY(login_name, project_id, parsedScopes),
                        fetchParams!.auth!,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                } else {
                    return parsedScopes;
                }
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                query: t.Object({
                    scope: t.Optional(t.String()),
                    page: t.Optional(t.String())
                }),
                detail: {
                    description: GITHUB_REPOSITORY_PARAMS,
                    tags: ['github']
                }
            })
            .get('/repositories/milestones/:milestone_id', async ({ fetchParams, params: { login_name, project_id, milestone_id }, query, set }) => {
                const parsedDepth = parseScopes<GITHUB_MILESTONES_DEPTH>(query.depth, GITHUB_MILESTONES_DEPTH, set);
                const parsedIssueStates = parseScopes<GITHUB_MILESTONE_ISSUE_STATES>(query.issue_states, GITHUB_MILESTONE_ISSUE_STATES, set);

                if (Array.isArray(parsedDepth) && Array.isArray(parsedIssueStates)) {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY(login_name, project_id, milestone_id, parsedDepth, parsedIssueStates),
                        fetchParams!.auth!,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                } else {
                    return [parsedDepth, parsedIssueStates];
                }
            }, {
                params: t.Object(GITHUB_PROJECT_MILESTONE_PARAMS),
                query: t.Object(GITHUB_MILESTONE_QUERY),
                detail: {
                    description: GITHUB_MILESTONE_PARAMS,
                    tags: ['github']
                }
            })

            .get('', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_DEFAULT_PROJECT(login_name, project_id, -1),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return response;
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github']
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

                return response;
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github']
                }
            })
            .get('/repositories', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                    GITHUB_PROJECT_REPOSITORIES(login_name, project_id, "user"),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return response;
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github']
                }
            })
            .get('/repositories/scoped', async ({ fetchParams, params: { login_name, project_id }, query, set }) => {
                const parsedScopes = parseScopes<GITHUB_REPOSITORY_SCOPES>(query.scope, GITHUB_REPOSITORY_SCOPES, set);

                if (Array.isArray(parsedScopes)) {
                    const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                        GITHUB_PROJECT_REPOSITORIES_AND_QUERY(login_name, project_id, parsedScopes, "user"),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                } else {
                    return parsedScopes;
                }
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                query: t.Object(GITHUB_REPOSITORY_SCOPE_QUERY),
                detail: {
                    description: GITHUB_REPOSITORY_PARAMS,
                    tags: ['github']
                }
            })
            .get('/repositories/milestones/:milestone_id', async ({ fetchParams, params: { login_name, project_id, milestone_id }, query, set }) => {
                const parsedDepth = parseScopes<GITHUB_MILESTONES_DEPTH>(query.depth, GITHUB_MILESTONES_DEPTH, set);
                const parsedIssueStates = parseScopes<GITHUB_MILESTONE_ISSUE_STATES>(query.issue_states, GITHUB_MILESTONE_ISSUE_STATES, set);

                if (Array.isArray(parsedDepth) && Array.isArray(parsedIssueStates)) {
                    const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                        GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY(login_name, project_id, milestone_id, parsedDepth, parsedIssueStates, "user"),
                        fetchParams!.auth!,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                } else {
                    return [parsedDepth, parsedIssueStates];
                }
            }, {
                params: t.Object(GITHUB_PROJECT_MILESTONE_PARAMS),
                query: t.Object(GITHUB_MILESTONE_QUERY),
                detail: {
                    description: GITHUB_MILESTONE_PARAMS,
                    tags: ['github']
                }
            })

            .get('', async ({ fetchParams, params: { login_name, project_id }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                    GITHUB_DEFAULT_PROJECT(login_name, project_id, -1, "user"),
                    fetchParams!.auth,
                    set,
                    fetchParams!.auth_type!
                );

                return response;
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                detail: {
                    description: "",
                    tags: ['github']
                }
            })
        )
    ));
