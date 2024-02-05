import { Organization, Repository } from "@octokit/graphql-schema"; // https://www.npmjs.com/package/@octokit/graphql-schema
import { Elysia, t } from "elysia"; // https://elysiajs.com/introduction.html
import 'dotenv/config'; // process.env.<ENV_VAR_NAME>
import {
    GITHUB_ORGANIZATION_PROJECT_BY_URL,
    GITHUB_ORGANIZATION_PROJECT_INFO_BY_URL,
    GITHUB_ORGANIZATION_PROJECT_REPOSITORIES_BY_URL,
    GITHUB_ORGANIZATION_PROJECT_REPOSITORIES_BY_URL_AND_QUERY,
    GITHUB_ORGANIZATION_PROJECT_REPOSITORY_MILESTONES_BY_URL_AND_QUERY,

    GITHUB_ORGANIZATION_BY_NAME,
    GITHUB_REPOSITORY_BY_OWNER_NAME_AND_REPOSITORY_NAME,
    GITHUB_PROJECT_BY_OWNER_NAME_AND_REPOSITORY_NAME_AND_PROJECT_NAME
} from "./github_graphql_queries";
import { fetchGithubDataUsingGraphql, validateViewParameter, isValidEnumArray } from "./github_functions";
import { GITHUB_ORGANIZATION_MILESTONES_DEPTH, GITHUB_ORGANIZATION_MILESTONE_ISSUE_STATES, GITHUB_REPOSITORY_SCOPES } from "./github_types";

const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_ORGANIZATION_PROJECT_PARAMS = {
    organization_name: t.String(),
    project_id: t.Numeric()
} as const;

const GITHUB_ORGANIZATION_PROJECT_MILESTONE_PARAMS = {
    ...GITHUB_ORGANIZATION_PROJECT_PARAMS,
    milestone_id: t.Numeric()
} as const;

export const GITHUB_URL_INPUT_TYPES = new Elysia({ prefix: '/input' })
    .get('/types', () => {
        const scopes = [];
        scopes.push({
            name: "GITHUB_REPOSITORY_SCOPES",
            description: "repository scopes",
            endpoint: "/github/url/orgs/{organization_name}/projects/{project_id}/repositories/scoped?scope=<SCOPE>",
            type: Object.values(GITHUB_REPOSITORY_SCOPES)
        });
        scopes.push({
            name: "GITHUB_ORGANIZATION_MILESTONES_DEPTH",
            description: "milestone scopes",
            endpoint: "/github/url/orgs/{organization_name}/projects/{project_id}/repositories/milestone/{milestone_id}?depth=<DEPTH_1,DEPTH_2>&issue_states=<ISSUE_STATE_1,ISSUE_STATE_2>",
            type: Object.values(GITHUB_ORGANIZATION_MILESTONES_DEPTH)
        }) 
        scopes.push({
            name: "GITHUB_ORGANIZATION_MILESTONE_ISSUE_STATES",
            description: "issue scopes",
            endpoint: "/github/url/orgs/{organization_name}/projects/{project_id}/repositories/milestone/{milestone_id}?depth=<DEPTH_1,DEPTH_2>&issue_states=<ISSUE_STATE_1,ISSUE_STATE_2>",
            type: Object.values(GITHUB_ORGANIZATION_MILESTONE_ISSUE_STATES)
        })

        return scopes;
    });

export const GITHUB_URL = new Elysia({ prefix: '/url' })
    .group("/orgs/:organization_name/projects/:project_id", (app) => app
        .get('/info', async ({ params: { organization_name, project_id }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_ORGANIZATION_PROJECT_INFO_BY_URL(organization_name, project_id),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_ORGANIZATION_PROJECT_PARAMS)
        })
        .get('/repositories', async ({ params: { organization_name, project_id }, set }) => { // deprecated, use /repositories/by with query `ALL` instead
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_ORGANIZATION_PROJECT_REPOSITORIES_BY_URL(organization_name, project_id),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_ORGANIZATION_PROJECT_PARAMS)
        })
        .get('/repositories/scoped', async ({ params: { organization_name, project_id }, query, set }) => {
            const scope_values = query.scope.split(',');
            const scope_values_are_of_valid_enum_type = isValidEnumArray(scope_values, Object.values(GITHUB_REPOSITORY_SCOPES));

            if (!scope_values_are_of_valid_enum_type) {
                set.status = 400;
                return JSON.stringify({ success: false, error: 'Invalid scope values' }, null, 2);
            }

            const scope = scope_values as GITHUB_REPOSITORY_SCOPES[];

            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_ORGANIZATION_PROJECT_REPOSITORIES_BY_URL_AND_QUERY(organization_name, project_id, scope),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_ORGANIZATION_PROJECT_PARAMS),
            query: t.Object({
                scope: t.String()
            })
        })
        .get('/repositories/milestone/:milestone_id', async ({ params: { organization_name, project_id, milestone_id }, query, set }) => {
            const depth_values = query.depth.split(',');
            const depth_values_are_of_valid_enum_type = isValidEnumArray(depth_values, Object.values(GITHUB_ORGANIZATION_MILESTONES_DEPTH));
            const issue_states_values = query.issue_states.split(',');
            const issue_states_values_are_of_valid_enum_type = isValidEnumArray(issue_states_values, Object.values(GITHUB_ORGANIZATION_MILESTONE_ISSUE_STATES));

            if (!depth_values_are_of_valid_enum_type) {
                set.status = 400;
                return JSON.stringify({ success: false, error: 'Invalid `depth` values' }, null, 2);
            }

            if (!issue_states_values_are_of_valid_enum_type) {
                set.status = 400;
                return JSON.stringify({ success: false, error: 'Invalid `issue_states` values' }, null, 2);
            }

            const depth = depth_values as GITHUB_ORGANIZATION_MILESTONES_DEPTH[];
            const issue_states = issue_states_values as GITHUB_ORGANIZATION_MILESTONE_ISSUE_STATES[];

            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_ORGANIZATION_PROJECT_REPOSITORY_MILESTONES_BY_URL_AND_QUERY(organization_name, project_id, milestone_id, depth, issue_states),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(
                GITHUB_ORGANIZATION_PROJECT_MILESTONE_PARAMS,
            ),
            query: t.Object({
                depth: t.String(),
                issue_states: t.String(),
            })
        })

        .get('', async ({ params: { organization_name, project_id }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_ORGANIZATION_PROJECT_BY_URL(organization_name, project_id, -1),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object(GITHUB_ORGANIZATION_PROJECT_PARAMS)
        })
        .get('/views/:project_view', async ({ params: { organization_name, project_id, project_view }, set }) => {
            const view  = project_view != "%7Bproject_view%7D" ? validateViewParameter(Number(project_view)) : -1;

            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_ORGANIZATION_PROJECT_BY_URL(organization_name, project_id, view),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object({
                ...GITHUB_ORGANIZATION_PROJECT_PARAMS,
                project_view: t.Optional(t.String()) // t.Numeric({min: 0})
            })
        })
    );

export const GITHUB_ORGANIZATION = new Elysia({ prefix: '/organization' })
    .group("/:organization_name", (app) => app
        .get('', async ({ params: { organization_name }, set }) => {
            const response = await fetchGithubDataUsingGraphql<{ organization: Organization }>(
                GITHUB_ORGANIZATION_BY_NAME(organization_name),
                GITHUB_PAT,
                set
            );

            return JSON.stringify(response, null, 2);
        }, {
            params: t.Object({
                organization_name: t.String()
            })
        })
        .group("/repository/:repository_name", (app) => app
            .get('', async (
                { params: { organization_name, repository_name }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ organization: Repository }>(
                    GITHUB_REPOSITORY_BY_OWNER_NAME_AND_REPOSITORY_NAME(organization_name, repository_name),
                    GITHUB_PAT,
                    set
                );

                return JSON.stringify(response, null, 2);
            }, {
                params: t.Object({
                    organization_name: t.String(),
                    repository_name: t.String()
                })
            })
            .get('/project/:project_name', async (
                { query, params: { organization_name, repository_name, project_name }, set }) => {
                const response = await fetchGithubDataUsingGraphql<{ repository: Repository }>(
                    GITHUB_PROJECT_BY_OWNER_NAME_AND_REPOSITORY_NAME_AND_PROJECT_NAME(organization_name, repository_name, project_name, validateViewParameter(query.view)),
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
                    organization_name: t.String(),
                    repository_name: t.String(),
                    project_name: t.String()
                })
            })
        )
    );
