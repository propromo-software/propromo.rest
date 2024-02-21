import { Organization, Repository, User } from "@octokit/graphql-schema"; // https://www.npmjs.com/package/@octokit/graphql-schema
import { Elysia, t } from "elysia"; // https://elysiajs.com/introduction.html
import 'dotenv/config'; // process.env.<ENV_VAR_NAME>
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
import { /* GITHUB_AUTHENTICATION_STRATEGY_OPTIONS,  */GITHUB_MILESTONES_DEPTH, GITHUB_MILESTONE_ISSUE_STATES, GITHUB_REPOSITORY_SCOPES } from "./github_types";

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

/* AUTHENTICATION WEBHOOK */

export const GITHUB_APP_AUTHENTICATION = new Elysia({ prefix: '/auth/app' })
    .post('', async ({ body }) => {
        return body;
    }, {
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
            description: "",
            tags: ['github', 'types']
        }
    });

/* PROJECT */

export const GITHUB_ORGS = new Elysia({ prefix: '/orgs' })
    .group("/:login_name/projects/:project_id", (app) => app
        .get('/infos', async ({ params: { login_name, project_id }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_PROJECT_INFO(login_name, project_id),
                GITHUB_PAT,
                set
            );

            /*
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_PROJECT_INFO(login_name, project_id),
                null,
                set,
                GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.APP
            );
            */

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_PROJECT_PARAMS),
            detail: {
                description: "",
                tags: ['github', 'projects']
            }
        })
        .get('/repositories', async ({ params: { login_name, project_id }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_PROJECT_REPOSITORIES(login_name, project_id),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_PROJECT_PARAMS),
            detail: {
                description: "",
                tags: ['github', 'repositories']
            }
        })
        .get('/repositories/scoped', async ({ params: { login_name, project_id }, query, set }) => {
            const parsedScopes = parseScopedRepositories(query.scope, set);

            if (Array.isArray(parsedScopes)) {
                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_PROJECT_REPOSITORIES_AND_QUERY(login_name, project_id, parsedScopes),
                    GITHUB_PAT,
                    set
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
        .get('/repositories/milestones/:milestone_id', async ({ params: { login_name, project_id, milestone_id }, query, set }) => {
            const parsedDepthAndIssueStates = parseMilestoneDepthAndIssueStates(query.depth, query.issue_states, set);

            if ('depth' in parsedDepthAndIssueStates && 'issue_states' in parsedDepthAndIssueStates) {
                const { depth, issue_states } = parsedDepthAndIssueStates;

                const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                    GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY(login_name, project_id, milestone_id, depth, issue_states),
                    GITHUB_PAT,
                    set
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

        .get('', async ({ params: { login_name, project_id }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_DEFAULT_PROJECT(login_name, project_id, -1),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_PROJECT_PARAMS),
            detail: {
                description: "",
                tags: ['github', 'projects']
            }
        })
        .get('/views/:project_view', async ({ params: { login_name, project_id, project_view }, set }) => {
            const view = validateViewParameter(project_view);

            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_DEFAULT_PROJECT(login_name, project_id, view),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_PROJECT_VIEWS_PARAMS),
            detail: {
                description: "`project_view` has to be greater than 0",
                tags: ['github', 'views']
            }
        }),
    );

export const GITHUB_USERS = new Elysia({ prefix: '/users' })
    .group("/:login_name/projects/:project_id", (app) => app
        .get('/infos', async ({ params: { login_name, project_id }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                GITHUB_PROJECT_INFO(login_name, project_id, "user"),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_PROJECT_PARAMS),
            detail: {
                description: "",
                tags: ['github', 'projects']
            }
        })
        .get('/repositories', async ({ params: { login_name, project_id }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                GITHUB_PROJECT_REPOSITORIES(login_name, project_id, "user"),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_PROJECT_PARAMS),
            detail: {
                description: "",
                tags: ['github', 'repositories']
            }
        })
        .get('/repositories/scoped', async ({ params: { login_name, project_id }, query, set }) => {
            const parsedScopes = parseScopedRepositories(query.scope, set);

            if (Array.isArray(parsedScopes)) {
                const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                    GITHUB_PROJECT_REPOSITORIES_AND_QUERY(login_name, project_id, parsedScopes, "user"),
                    GITHUB_PAT,
                    set
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
        .get('/repositories/milestones/:milestone_id', async ({ params: { login_name, project_id, milestone_id }, query, set }) => {
            const parsedDepthAndIssueStates = parseMilestoneDepthAndIssueStates(query.depth, query.issue_states, set);

            if ('depth' in parsedDepthAndIssueStates && 'issue_states' in parsedDepthAndIssueStates) {
                const { depth, issue_states } = parsedDepthAndIssueStates;

                const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                    GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY(login_name, project_id, milestone_id, depth, issue_states, "user"),
                    GITHUB_PAT,
                    set
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

        .get('', async ({ params: { login_name, project_id }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                GITHUB_DEFAULT_PROJECT(login_name, project_id, -1, "user"),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_PROJECT_PARAMS),
            detail: {
                description: "",
                tags: ['github', 'projects']
            }
        })
        .get('/views/:project_view', async ({ params: { login_name, project_id, project_view }, set }) => {
            const view = validateViewParameter(project_view);

            const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                GITHUB_DEFAULT_PROJECT(login_name, project_id, view, "user"),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_PROJECT_VIEWS_PARAMS),
            detail: {
                description: "`project_view` has to be greater than 0",
                tags: ['github', 'views']
            }
        }),
    );

/* ORGANIZATION (TESTING) */

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
