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
import { GITHUB_ACCOUNT_SCOPES, GITHUB_PROJECT_SCOPES, GITHUB_REPOSITORY_SCOPES, type PageSize } from "../github/types";
import { GITHUB_ACCOUNT_PARAMS, GITHUB_PROJECT_PARAMS, GITHUB_REPOSITORY_PARAMS } from "./params";
import { OrganizationFetcher, Repository, UserFetcher } from "./scopes";

const log = createPinoLogger();
// const GITHUB_PAT = process.env.GITHUB_PAT; // TODO: multiple tokens like this token;token;token... for key rotation for public repositories, if user didn't provide a token
// TODO: test all endpoints

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
                        description: "Get the token quota, that is left for the current hour. 5000 tokens can be used per hour.",
                        tags: ['github']
                    }
                })
            )
        )
    ))

/* ENDPOINTS */

const ACCOUNT_LEVEL_OPTIONS = (login_type: "organization" | "user" = "organization", description: string | null = null) => {
    const desc = description ?? `Request anything in the ${login_type} scope. Allowed scopes for the account level: ${GITHUB_ACCOUNT_PARAMS}.`;

    return {
        params: t.Object({
            login_name: t.String()
        }),
        body: t.Object({
            scopes: t.Array(t.Object({
                scopeName: t.Optional(t.Enum(GITHUB_ACCOUNT_SCOPES, { default: "essential" })),
                pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
                ContinueAfter: t.MaybeEmpty(t.String())
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
                .group("/projects", (app) => app
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
                                    ContinueAfter: t.MaybeEmpty(t.String())
                                }))
                            }),
                            detail: {
                                description: `Request anything in the organization project (info and repositories). 
                                Scopes for the project level: ${GITHUB_PROJECT_PARAMS}.
                                Scopes for the repository level: ${GITHUB_REPOSITORY_PARAMS}.`,
                                tags: ['github']
                            }
                        })
                        /**
                         * Request info in the organization project.
                         */
                        .get('/infos', async ({ fetchParams, params: { login_name, project_id_or_name }, set }) => {
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
                                        ContinueAfter: t.MaybeEmpty(t.String())
                                    }))
                                }),
                                detail: {
                                    description: `Request repositories in the organization project.
                                    Scopes for the repository level: ${GITHUB_REPOSITORY_PARAMS}.`,
                                    tags: ['github']
                                }
                            })

                            // TODO, option to fetch milestones and issues for only one repository. fetch scope: /scopeName?pageSize=1&ContinueAfter=abc

                            /**
                             * TODO: Milestones. And issues endpoints, to make fetching simpler by allowing get instead of post.
                             */
                        )
                    )
                )
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
                            ContinueAfter: t.MaybeEmpty(t.String())
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
