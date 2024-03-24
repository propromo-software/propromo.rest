import type { Organization, ProjectV2, RateLimit, User } from "@octokit/graphql-schema";
import { Elysia, t } from "elysia";
import {
    AccountScopeEntryRoot,
    GITHUB_QUOTA,
    Project,
    getAllRepositoriesInProject
} from "./graphql";
import { fetchGithubDataUsingGraphql, fetchRateLimit } from "./functions/fetch";
import { createPinoLogger } from '@bogeychan/elysia-logger';
import { RESOLVE_JWT } from "./functions/authenticate";
import { guardEndpoints } from "./plugins";
import { GITHUB_ACCOUNT_SCOPES, GITHUB_MILESTONE_ISSUE_STATES, GITHUB_PROJECT_SCOPES, GITHUB_REPOSITORY_SCOPES, GRAMMATICAL_NUMBER, type PageSize } from "../github/types";
import { GITHUB_ACCOUNT_PARAMS, GITHUB_PROJECT_PARAMS, GITHUB_REPOSITORY_PARAMS } from "./params";
import { OrganizationFetcher, Repository, UserFetcher } from "./scopes";
import { parseScopes } from "./functions/parse";

const log = createPinoLogger();
// const GITHUB_PAT = process.env.GITHUB_PAT; // TODO: multiple tokens like this token;token;token... for key rotation for public repositories, if user didn't provide a token
// TODO: write tests for all endpoints

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
            description: "Receives a webhook event of the changes that happened in the scopes that this microservice is subscribed to, on your GitHub-App installation.",
            tags: ['github', 'webhooks']
        }
    });

/* GENERAL */

export const GITHUB_GENERAL = new Elysia({ prefix: '/info' })
    .use(guardEndpoints(new Elysia()
        .group("", (app) => app
            .use(RESOLVE_JWT)
            .group("/quota", (app) => app
                .get('/', async ({ fetchParams, set }) => {
                    const response = await fetchRateLimit(
                        fetchParams.auth,
                        set
                    );

                    return response;
                }, {
                    detail: {
                        description: "Get the token quota, that is left for the current hour. 5000 tokens can be used per hour.",
                        tags: ['github']
                    }
                })
                .get('/graphql', async ({ fetchParams, set }) => {
                    const response = await fetchGithubDataUsingGraphql<{ rateLimit: RateLimit } | undefined | null>(
                        GITHUB_QUOTA,
                        fetchParams.auth,
                        set
                    );

                    return response?.data?.rateLimit;
                }, {
                    detail: {
                        description: "Get the token quota, that is left for the current hour for graphql only. 5000 tokens can be used per hour.",
                        tags: ['github']
                    }
                })
            )
        )
    ))

/* ENDPOINTS */

// DO THIS FOR EVERY ENDPOINT, so that it is not duplicated for org and user
const ACCOUNT_LEVEL_OPTIONS = (login_type: "organization" | "user" = "organization", description: string | null = null) => {
    const desc = description ??
        `Request anything in the ${login_type} scope.  
        Allowed scopes for the account level: ${GITHUB_ACCOUNT_PARAMS}.`;

    return {
        params: t.Object({
            login_name: t.String()
        }),
        body: t.Object({
            scopes: t.Array(t.Object({
                scopeName: t.Optional(t.Enum(GITHUB_ACCOUNT_SCOPES, { default: "essential" })),
                pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                continueAfter: t.Optional(t.MaybeEmpty(t.String()))
            }))
        }),
        detail: {
            description: desc,
            tags: ['github']
        }
    }
}

export const GITHUB_ORGS = new Elysia({ prefix: '/orgs' })
    .use(guardEndpoints(new Elysia()
        .group("", (app) => app
            .use(RESOLVE_JWT)
            .group("/:login_name", (app) => app
                /**
                 * Request anything in the organization.
                 */
                .post('', async ({ fetchParams, params: { login_name }, body, set }) => {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        new OrganizationFetcher(login_name, body.scopes as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                }, ACCOUNT_LEVEL_OPTIONS("organization"))
                /**
                 * Request organization info.
                 */
                .get('/essential', async ({ fetchParams, params: { login_name }, set }) => {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        new OrganizationFetcher(login_name, [{
                            scopeName: GITHUB_ACCOUNT_SCOPES.ESSENTIAL,
                            pageSize: 1,
                            continueAfter: null
                        }] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                }, {
                    params: t.Object({
                        login_name: t.String()
                    }),
                    detail: {
                        description: "Request essential infos of the organization.",
                        tags: ['github']
                    }
                })
                /**
                 * Request organization info.
                 */
                .get('/info', async ({ fetchParams, params: { login_name }, set }) => {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        new OrganizationFetcher(login_name, [{
                            scopeName: GITHUB_ACCOUNT_SCOPES.INFO,
                            pageSize: 1,
                            continueAfter: null
                        }] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                }, {
                    params: t.Object({
                        login_name: t.String()
                    }),
                    detail: {
                        description: "Request infos of the organization.",
                        tags: ['github']
                    }
                })
                /**
                 * Request organization packages.
                 */
                .get('/packages', async ({ fetchParams, params: { login_name }, query, set }) => {
                    const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                        new OrganizationFetcher(login_name, [{
                            scopeName: GITHUB_ACCOUNT_SCOPES.PACKAGES,
                            pageSize: query.pageSize ?? 1,
                            continueAfter: query.continueAfter
                        }] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                }, {
                    params: t.Object({
                        login_name: t.String()
                    }),
                    query: t.Object({
                        pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                        continueAfter: t.Optional(t.String())
                    }),
                    detail: {
                        description: "Request packages of the organization. (`/packages?pageSize=1&continueAfter=abc`)",
                        tags: ['github']
                    }
                })
                .group("/projects", (app) => app
                    /**
                     * Request organization projects.
                     */
                    .get('', async ({ fetchParams, params: { login_name }, query, set }) => {
                        const response = await fetchGithubDataUsingGraphql<{ projects: ProjectV2 }>(
                            new OrganizationFetcher(login_name, [{
                                scopeName: GITHUB_ACCOUNT_SCOPES.PROJECTS,
                                pageSize: query.pageSize ?? 1,
                                continueAfter: query.continueAfter
                            }] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
                            fetchParams!.auth,
                            set,
                            fetchParams!.auth_type!
                        );

                        return response;
                    }, {
                        params: t.Object({
                            login_name: t.String()
                        }),
                        query: t.Object({
                            pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                            continueAfter: t.Optional(t.String())
                        }),
                        detail: {
                            description: "Request projects of the organization. (`/projects?pageSize=1&continueAfter=abc`)",
                            tags: ['github']
                        }
                    })
                    .group("/:project_id_or_name", (app) => app
                        /**
                         * Request anything in the organization project. (info and/or repositories)
                         */
                        .post('', async ({ fetchParams, params: { login_name, project_id_or_name }, body, set }) => {
                            const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                AccountScopeEntryRoot(
                                    login_name,
                                    getAllRepositoriesInProject(
                                        project_id_or_name,
                                        body.project_scopes,
                                        body.repository_scopes as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                    )
                                ),
                                fetchParams!.auth,
                                set,
                                fetchParams!.auth_type!
                            );

                            return response;
                        }, {
                            transform({ params }) {
                                const project_id_or_name = +params.project_id_or_name

                                if (!Number.isNaN(project_id_or_name))
                                    params.project_id_or_name = project_id_or_name
                            },
                            params: t.Object({
                                login_name: t.String(),
                                project_id_or_name: t.Union([t.String(), t.Number()])
                            }),
                            body: t.Object({
                                project_scopes: t.Array(t.Optional(t.Enum(GITHUB_PROJECT_SCOPES)), { default: ["info"] }),
                                repository_scopes: t.Array(t.Object({
                                    scopeName: t.Optional(t.Enum(GITHUB_REPOSITORY_SCOPES, { default: "info" })),
                                    pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }))
                            }),
                            detail: {
                                description: `Request anything in the organization project.  
                                Scopes for the project level: ${GITHUB_PROJECT_PARAMS}.  
                                Scopes for the repository level, that only take effect, if the project scopes include **repositories**: ${GITHUB_REPOSITORY_PARAMS}.`,
                                tags: ['github']
                            }
                        })
                        /**
                         * Request info in the organization project.
                         */
                        .get('/info', async ({ fetchParams, params: { login_name, project_id_or_name }, set }) => {
                            const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                AccountScopeEntryRoot(login_name, Project(project_id_or_name, [GITHUB_PROJECT_SCOPES.INFO]), "organization"),
                                fetchParams!.auth,
                                set,
                                fetchParams!.auth_type!
                            );

                            return response;
                        }, {
                            transform({ params }) {
                                const project_id_or_name = +params.project_id_or_name

                                if (!Number.isNaN(project_id_or_name))
                                    params.project_id_or_name = project_id_or_name
                            },
                            params: t.Object({
                                login_name: t.String(),
                                project_id_or_name: t.Union([t.String(), t.Number()])
                            }),
                            detail: {
                                description: `Request anything in the organization project (info and repositories).
                                Allowed scopes for the account level: ${GITHUB_ACCOUNT_PARAMS}.`,
                                tags: ['github']
                            }
                        })

                        /**
                         * Request repositories only in the organization project. No infos.
                         */
                        .group("/repositories", (app) => app
                            .post('', async ({ fetchParams, params: { login_name, project_id_or_name }, body, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            body.scopes as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                body: t.Object({
                                    scopes: t.Array(t.Object({
                                        scopeName: t.Optional(t.Enum(GITHUB_REPOSITORY_SCOPES, { default: "info" })),
                                        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                                        continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                    }))
                                }),
                                detail: {
                                    description: `Request repositories in the organization project.
                                    Scopes for the repository level: ${GITHUB_REPOSITORY_PARAMS}.`,
                                    tags: ['github']
                                }
                            })
                            .get('/count', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [{
                                                scopeName: "count",
                                                pageSize: query.pageSize ?? 1,
                                                continueAfter: query.continueAfter
                                            }] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository count in the organization project. (pageSize and continueAfter are for the repositories, because this endpoint doesn't have child nodes)",
                                    tags: ['github']
                                }
                            })
                            .get('/essential', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [{
                                                scopeName: "essential",
                                                pageSize: query.pageSize ?? 1,
                                                continueAfter: query.continueAfter
                                            }] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository essential info in the organization project. (pageSize and continueAfter are for the repositories, because this endpoint doesn't have child nodes)",
                                    tags: ['github']
                                }
                            })
                            .get('/info', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [{
                                                scopeName: "info",
                                                pageSize: query.pageSize ?? 1,
                                                continueAfter: query.continueAfter
                                            }] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository info in the organization project. (pageSize and continueAfter are for the repositories, because this endpoint doesn't have child nodes)",
                                    tags: ['github']
                                }
                            })
                            .get('/license', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [{
                                                scopeName: "license",
                                                pageSize: query.pageSize ?? 1,
                                                continueAfter: query.continueAfter
                                            }] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository license in the organization project. (pageSize and continueAfter are for the repositories, because this endpoint doesn't have child nodes)",
                                    tags: ['github']
                                }
                            })

                            /**
                             * Having children.
                             */
                            .get('/vulnerabilities', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [
                                                {
                                                    scopeName: "vulnerabilities",
                                                    pageSize: query.pageSize ?? 1,
                                                    continueAfter: query.continueAfter
                                                },
                                                {
                                                    scopeName: "count",
                                                    pageSize: query.rootPageSize ?? 1,
                                                    continueAfter: query.rootContinueAfter
                                                },
                                            ] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository vulnerabilities in the organization project.",
                                    tags: ['github']
                                }
                            })
                            .get('/topics', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [
                                                {
                                                    scopeName: "topics",
                                                    pageSize: query.pageSize ?? 1,
                                                    continueAfter: query.continueAfter
                                                },
                                                {
                                                    scopeName: "count",
                                                    pageSize: query.rootPageSize ?? 1,
                                                    continueAfter: query.rootContinueAfter
                                                },
                                            ] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository topics in the organization project.",
                                    tags: ['github']
                                }
                            })
                            .get('/labels', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [
                                                {
                                                    scopeName: "labels",
                                                    pageSize: query.pageSize ?? 1,
                                                    continueAfter: query.continueAfter
                                                },
                                                {
                                                    scopeName: "count",
                                                    pageSize: query.rootPageSize ?? 1,
                                                    continueAfter: query.rootContinueAfter
                                                },
                                            ] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository labels in the organization project.",
                                    tags: ['github']
                                }
                            })
                            .get('/releases', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [
                                                {
                                                    scopeName: "releases",
                                                    pageSize: query.pageSize ?? 1,
                                                    continueAfter: query.continueAfter
                                                },
                                                {
                                                    scopeName: "count",
                                                    pageSize: query.rootPageSize ?? 1,
                                                    continueAfter: query.rootContinueAfter
                                                },
                                            ] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository releases in the organization project.",
                                    tags: ['github']
                                }
                            })
                            .get('/deployments', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [
                                                {
                                                    scopeName: "deployments",
                                                    pageSize: query.pageSize ?? 1,
                                                    continueAfter: query.continueAfter
                                                },
                                                {
                                                    scopeName: "count",
                                                    pageSize: query.rootPageSize ?? 1,
                                                    continueAfter: query.rootContinueAfter
                                                },
                                            ] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository deployments in the organization project.",
                                    tags: ['github']
                                }
                            })
                            .get('/languages', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [
                                                {
                                                    scopeName: "languages",
                                                    pageSize: query.pageSize ?? 1,
                                                    continueAfter: query.continueAfter
                                                },
                                                {
                                                    scopeName: "count",
                                                    pageSize: query.rootPageSize ?? 1,
                                                    continueAfter: query.rootContinueAfter
                                                },
                                            ] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository languages in the organization project.",
                                    tags: ['github']
                                }
                            })
                            .group("/milestones", (app) => app
                                .get('', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                    const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                        AccountScopeEntryRoot(
                                            login_name,
                                            getAllRepositoriesInProject(
                                                project_id_or_name,
                                                [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                                [
                                                    {
                                                        scopeName: "milestones",
                                                        pageSize: query.pageSize ?? 1,
                                                        continueAfter: query.continueAfter
                                                    },
                                                    {
                                                        scopeName: "count",
                                                        pageSize: query.rootPageSize ?? 1,
                                                        continueAfter: query.rootContinueAfter
                                                    },
                                                ] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                            )
                                        ),
                                        fetchParams!.auth,
                                        set,
                                        fetchParams!.auth_type!
                                    );

                                    return response;
                                }, {
                                    transform({ params }) {
                                        const project_id_or_name = +params.project_id_or_name

                                        if (!Number.isNaN(project_id_or_name))
                                            params.project_id_or_name = project_id_or_name
                                    },
                                    params: t.Object({
                                        login_name: t.String(),
                                        project_id_or_name: t.Union([t.String(), t.Number()])
                                    }),
                                    query: t.Object({
                                        rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                        rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                        pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                        continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                    }),
                                    detail: {
                                        description: "Request repository milestones in the organization project.",
                                        tags: ['github']
                                    }
                                })
                                .get('/issues', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                    const issues_states = parseScopes<GITHUB_MILESTONE_ISSUE_STATES>(query.issues_states ?? GITHUB_MILESTONE_ISSUE_STATES.OPEN, GITHUB_MILESTONE_ISSUE_STATES, set, [GITHUB_MILESTONE_ISSUE_STATES.OPEN])

                                    const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                        AccountScopeEntryRoot(
                                            login_name,
                                            getAllRepositoriesInProject(
                                                project_id_or_name,
                                                [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                                [
                                                    {
                                                        scopeName: "milestones",
                                                        pageSize: query.milestonesPageSize ?? 1,
                                                        continueAfter: query.milestonesContinueAfter
                                                    },
                                                    {
                                                        scopeName: "issues",
                                                        pageSize: query.issuesPageSize ?? 1,
                                                        continueAfter: query.issuesContinueAfter
                                                    },
                                                    {
                                                        scopeName: "count",
                                                        pageSize: query.rootPageSize ?? 1,
                                                        continueAfter: query.rootContinueAfter
                                                    },
                                                ] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
                                                issues_states
                                            )
                                        ),
                                        fetchParams!.auth,
                                        set,
                                        fetchParams!.auth_type!
                                    );

                                    return response;
                                }, {
                                    transform({ params }) {
                                        const project_id_or_name = +params.project_id_or_name

                                        if (!Number.isNaN(project_id_or_name))
                                            params.project_id_or_name = project_id_or_name
                                    },
                                    params: t.Object({
                                        login_name: t.String(),
                                        project_id_or_name: t.Union([t.String(), t.Number()])
                                    }),
                                    query: t.Object({
                                        rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                        rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                        milestonesPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                        milestonesContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                        issuesPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                        issuesContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                        issues_states: t.Optional(t.String()) // enum arrays can not be passed directly in query params, that is why this parameter is validated in the callback
                                    }),
                                    detail: {
                                        description: "Request repository milestones issues in the organization project.",
                                        tags: ['github']
                                    }
                                })

                                .group("/:milestone_id", (app) => app
                                    .get('', async ({ fetchParams, params: { login_name, project_id_or_name, milestone_id }, query, set }) => {
                                        const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                            AccountScopeEntryRoot(
                                                login_name,
                                                getAllRepositoriesInProject(
                                                    project_id_or_name,
                                                    [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                                    [
                                                        {
                                                            scopeName: "milestones", // fetches a single milestone, because amount is set to singular
                                                            pageSize: null ?? 1,
                                                            continueAfter: null
                                                        },
                                                        {
                                                            scopeName: "count",
                                                            pageSize: query.pageSize ?? 1,
                                                            continueAfter: query.continueAfter
                                                        },
                                                    ] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
                                                    null,
                                                    GRAMMATICAL_NUMBER.SINGULAR,
                                                    milestone_id
                                                )
                                            ),
                                            fetchParams!.auth,
                                            set,
                                            fetchParams!.auth_type!
                                        );

                                        return response;
                                    }, {
                                        transform({ params }) {
                                            const project_id_or_name = +params.project_id_or_name

                                            if (!Number.isNaN(project_id_or_name))
                                                params.project_id_or_name = project_id_or_name
                                        },
                                        params: t.Object({
                                            login_name: t.String(),
                                            project_id_or_name: t.Union([t.String(), t.Number()]),
                                            milestone_id: t.Numeric()
                                        }),
                                        query: t.Object({
                                            pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                            continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                        }),
                                        detail: {
                                            description: "Request repository milestone in the organization project.",
                                            tags: ['github']
                                        }
                                    })
                                    .get('/issues', async ({ fetchParams, params: { login_name, project_id_or_name, milestone_id }, query, set }) => {
                                        const issues_states = parseScopes<GITHUB_MILESTONE_ISSUE_STATES>(query.issues_states ?? GITHUB_MILESTONE_ISSUE_STATES.OPEN, GITHUB_MILESTONE_ISSUE_STATES, set, [GITHUB_MILESTONE_ISSUE_STATES.OPEN])

                                        const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                            AccountScopeEntryRoot(
                                                login_name,
                                                getAllRepositoriesInProject(
                                                    project_id_or_name,
                                                    [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                                    [
                                                        {
                                                            scopeName: "milestones",
                                                            pageSize: query.milestonesPageSize ?? 1,
                                                            continueAfter: query.milestonesContinueAfter
                                                        },
                                                        {
                                                            scopeName: "issues",
                                                            pageSize: query.issuesPageSize ?? 1,
                                                            continueAfter: query.issuesContinueAfter
                                                        },
                                                        {
                                                            scopeName: "count",
                                                            pageSize: query.rootPageSize ?? 1,
                                                            continueAfter: query.rootContinueAfter
                                                        },
                                                    ] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
                                                    issues_states,
                                                    GRAMMATICAL_NUMBER.SINGULAR,
                                                    milestone_id
                                                )
                                            ),
                                            fetchParams!.auth,
                                            set,
                                            fetchParams!.auth_type!
                                        );

                                        return response;
                                    }, {
                                        transform({ params }) {
                                            const project_id_or_name = +params.project_id_or_name

                                            if (!Number.isNaN(project_id_or_name))
                                                params.project_id_or_name = project_id_or_name
                                        },
                                        params: t.Object({
                                            login_name: t.String(),
                                            project_id_or_name: t.Union([t.String(), t.Number()]),
                                            milestone_id: t.Numeric()
                                        }),
                                        query: t.Object({
                                            rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                            rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                            milestonesPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                            milestonesContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                            issuesPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                            issuesContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                            issues_states: t.Optional(t.String()) // enum arrays can not be passed directly in query params, that is why this parameter is validated in the callback
                                        }),
                                        detail: {
                                            description: "Request repository milestone issues in the organization project. (issues_states=open,closed || issues_states=open || issues_states=closed)",
                                            tags: ['github']
                                        }
                                    })
                                )
                            )
                            .get('/issues', async ({ fetchParams, params: { login_name, project_id_or_name }, query, set }) => {
                                const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                                    AccountScopeEntryRoot(
                                        login_name,
                                        getAllRepositoriesInProject(
                                            project_id_or_name,
                                            [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                                            [
                                                {
                                                    scopeName: "issues",
                                                    pageSize: query.pageSize ?? 1,
                                                    continueAfter: query.continueAfter
                                                },
                                                {
                                                    scopeName: "count",
                                                    pageSize: query.rootPageSize ?? 1,
                                                    continueAfter: query.rootContinueAfter
                                                },
                                            ] as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                                        )
                                    ),
                                    fetchParams!.auth,
                                    set,
                                    fetchParams!.auth_type!
                                );

                                return response;
                            }, {
                                transform({ params }) {
                                    const project_id_or_name = +params.project_id_or_name

                                    if (!Number.isNaN(project_id_or_name))
                                        params.project_id_or_name = project_id_or_name
                                },
                                params: t.Object({
                                    login_name: t.String(),
                                    project_id_or_name: t.Union([t.String(), t.Number()])
                                }),
                                query: t.Object({
                                    rootPageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    rootContinueAfter: t.Optional(t.MaybeEmpty(t.String())),
                                    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                                    continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                                }),
                                detail: {
                                    description: "Request repository issues in the organization project.",
                                    tags: ['github']
                                }
                            })
                        )
                    )
                )
                /**
                 * Request a repository in the organization project.
                 */
                .post('repository/:repository_name', async ({ fetchParams, params: { login_name, repository_name }, body, set }) => {
                    const response = await fetchGithubDataUsingGraphql<{ project: ProjectV2 }>(
                        AccountScopeEntryRoot(
                            login_name,
                            new Repository({
                                name: repository_name,
                                scopes: body.scopes as PageSize<GITHUB_REPOSITORY_SCOPES>[]
                            }).getQuery(),
                            "organization"
                        ),
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
                    body: t.Object({
                        scopes: t.Array(t.Object({
                            scopeName: t.Optional(t.Enum(GITHUB_REPOSITORY_SCOPES, { default: "info" })),
                            pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                            continueAfter: t.Optional(t.MaybeEmpty(t.String()))
                        }))
                    }),
                    detail: {
                        description: `Request a repository in the organization project.
                        Scopes for the repository level: ${GITHUB_REPOSITORY_PARAMS}.`,
                        tags: ['github']
                    }
                })
            )
        )
    ));

export const GITHUB_USERS = new Elysia({ prefix: '/users' })
    .use(guardEndpoints(new Elysia()
        .group("", (app) => app
            .use(RESOLVE_JWT)
            .group("/:login_name", (app) => app
                .post('', async ({ fetchParams, params: { login_name }, body, set }) => {
                    const response = await fetchGithubDataUsingGraphql<{ user: User }>(
                        new UserFetcher(login_name, body.scopes as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
                        fetchParams!.auth,
                        set,
                        fetchParams!.auth_type!
                    );

                    return response;
                }, ACCOUNT_LEVEL_OPTIONS("user"))

                // TODO
            )
        )
    ));
