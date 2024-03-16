import { Organization, User } from "@octokit/graphql-schema";
import { Elysia, t } from "elysia";
import {
    GITHUB_DEFAULT_PROJECT,
    GITHUB_PROJECT_INFO,
    GITHUB_PROJECT_REPOSITORIES,
    GITHUB_PROJECT_REPOSITORIES_AND_QUERY,
    GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY
} from "./graphql";
import { GITHUB_REPOSITORY_PARAMS, GITHUB_MILESTONE_PARAMS } from "./params";
import { parseMilestoneDepthAndIssueStates, parseScopedRepositories } from "./functions/parse";
import { fetchGithubDataUsingGraphql } from "./functions/fetch";
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

        return JSON.stringify(ctx.body, null, 2);
    }, {
        detail: {
            description: "",
            tags: ['github', 'webhooks']
        }
    });

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
                const parsedScopes = parseScopedRepositories(query.scope, set);

                if (Array.isArray(parsedScopes)) {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        GITHUB_PROJECT_REPOSITORIES_AND_QUERY(login_name, project_id, parsedScopes),
                        fetchParams!.auth!,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                } else {
                    return JSON.stringify(parsedScopes, null, 2);
                }
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                query: t.Object(GITHUB_REPOSITORY_SCOPE_QUERY),
                detail: {
                    description: JSON.stringify(GITHUB_REPOSITORY_PARAMS, null, 2),
                    tags: ['github']
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

                    return response;
                } else {
                    return JSON.stringify(parsedDepthAndIssueStates, null, 2);
                }
            }, {
                params: t.Object(GITHUB_PROJECT_MILESTONE_PARAMS),
                query: t.Object(GITHUB_MILESTONE_QUERY),
                detail: {
                    description: JSON.stringify(GITHUB_MILESTONE_PARAMS, null, 2),
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
                const parsedScopes = parseScopedRepositories(query.scope, set);

                if (Array.isArray(parsedScopes)) {
                    const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                        GITHUB_PROJECT_REPOSITORIES_AND_QUERY(login_name, project_id, parsedScopes, "user"),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                } else {
                    return JSON.stringify(parsedScopes, null, 2);
                }
            }, {
                params: t.Object(GITHUB_PROJECT_PARAMS),
                query: t.Object(GITHUB_REPOSITORY_SCOPE_QUERY),
                detail: {
                    description: JSON.stringify(GITHUB_REPOSITORY_PARAMS, null, 2),
                    tags: ['github']
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

                    return response;
                } else {
                    return JSON.stringify(parsedDepthAndIssueStates, null, 2);
                }
            }, {
                params: t.Object(GITHUB_PROJECT_MILESTONE_PARAMS),
                query: t.Object(GITHUB_MILESTONE_QUERY),
                detail: {
                    description: JSON.stringify(GITHUB_MILESTONE_PARAMS, null, 2),
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
