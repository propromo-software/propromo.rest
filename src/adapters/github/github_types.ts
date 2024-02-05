import { ElysiaErrors } from "elysia/dist/error";

export interface GraphqlResponse<T> {
    error?: any;
    success?: boolean;
    data?: T;

    // ElysiaErrors
    server?: ElysiaErrors

    // GraphqlResponseError
    cause?: unknown;
    path?: [any];
    type?: string | undefined;
}

// in type GraphQlQueryResponse<ResponseData> of @octokit/graphql (has string as type...)
export enum GraphqlResponseErrorCode {
    NOT_FOUND = "NOT_FOUND",
}

export enum GRAMMATICAL_NUMBER {
    SINGULAR = 1,
    PLURAL = 0,
    DEFAULT = -1
}

export enum GITHUB_REPOSITORY_SCOPES {
    COUNT = "count",
    INFO = "info",
    LICENSE = "license",
    VULNERABILITIES = "vulnerabilities",
    TOPICS = "topics",
    LABELS = "labels",
    RELEASES = "releases",
    DEPLOYMENTS = "deployments",
    MILESTONES = "milestones",
    ISSUES = "issues",
    ALL = "all"
}

export enum GITHUB_PROJECT_SCOPES {
    INFO = "root",
    REPOSITORIES_LINKED = "repositories"
}

export type GITHUB_PROJECT_INPUT_SCOPES = GITHUB_PROJECT_SCOPES[] | {project_scopes: GITHUB_PROJECT_SCOPES[], repository_scopes: null | GITHUB_REPOSITORY_SCOPES[]};
export const GITHUB_PROJECT_INPUT_SCOPES_AS_OBJECT = {
    "OPTION_1": Object.values(GITHUB_PROJECT_SCOPES).join(" | "),
    "OPTION_2": {
        "project_scopes": Object.values(GITHUB_PROJECT_SCOPES).join(" | "), 
        "repository_scopes": {
            "OPTION_1": null,
            "OPTION_2": Object.values(GITHUB_REPOSITORY_SCOPES).join(" | ")
        }
    }
}

export enum GITHUB_ORGANIZATION_MILESTONES_DEPTH {
    INFO = "info",
    ISSUES = "issues"
}

export enum GITHUB_ORGANIZATION_MILESTONE_ISSUE_STATES {
    OPEN = "open",
    CLOSED = "closed"
}
