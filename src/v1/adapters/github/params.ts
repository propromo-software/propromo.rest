import { GITHUB_REPOSITORY_SCOPES, GITHUB_MILESTONES_DEPTH, GITHUB_MILESTONE_ISSUE_STATES, GITHUB_ORGANIZATION_SCOPES } from "./types";

export const GITHUB_REPOSITORY_PARAMS = [
    {
        name: "GITHUB_REPOSITORY_SCOPES",
        description: "repository scopes",
        endpoint: "/github/orgs/{login_name}/projects/{project_id}/repositories/scoped?scope=<SCOPE>",
        type: Object.values(GITHUB_REPOSITORY_SCOPES)
    }
]

export const GITHUB_MILESTONE_PARAMS = [
    {
        name: "GITHUB_MILESTONES_DEPTH",
        description: "milestone scopes",
        endpoint: "/github/orgs/{login_name}/projects/{project_id}/repositories/milestones/{milestone_id}?depth=<DEPTH_1,DEPTH_2>&issue_states=<ISSUE_STATE_1,ISSUE_STATE_2>",
        type: Object.values(GITHUB_MILESTONES_DEPTH)
    },
    {
        name: "GITHUB_MILESTONE_ISSUE_STATES",
        description: "issue scopes",
        endpoint: "/github/orgs/{login_name}/projects/{project_id}/repositories/milestones/{milestone_id}?depth=<DEPTH_1,DEPTH_2>&issue_states=<ISSUE_STATE_1,ISSUE_STATE_2>",
        type: Object.values(GITHUB_MILESTONE_ISSUE_STATES)
    }
]

export const GITHUB_ORGANIZATION_PARAMS = [
    {
        name: "GITHUB_ORGANIZATION_SCOPES",
        description: "organization scopes",
        endpoint: "/github/orgs/info/{login_name}?scope=<SCOPE>?page=<SCOPE:PAGE_SIZE>",
        type: Object.values(GITHUB_ORGANIZATION_SCOPES)
    },
    {
        name: "GITHUB_PROJECT_SCOPES",
        description: "organization scopes",
        endpoint: "/github/orgs/info/{login_name}?scope=<SCOPE>?page=<SCOPE:PAGE_SIZE>",
        type: Object.values({
            scopeName: GITHUB_ORGANIZATION_SCOPES,
            pageSize: "number > 0 && number <= 100"
        })
    }
]
