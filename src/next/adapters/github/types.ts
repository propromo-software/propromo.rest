// https://www.npmjs.com/package/@octokit/types
import type { ElysiaErrors } from "elysia/dist/error";
import type {
    GetResponseTypeFromEndpointMethod,
    RequestParameters
} from "@octokit/types";
import { Octokit } from "octokit";

/* AUTHENTICATION */

export interface TokenVerifier {
    // biome-ignore lint/suspicious/noExplicitAny:
    verify(bearer: string | undefined): Promise<any>;
}

/* REST/GRAPHQL */

// type UnionOfKeys<T> = keyof T extends infer U ? U : never;
// export type UnionOfValues<T> = T[keyof T];

const octokit = new Octokit();
export type GetRateLimit = GetResponseTypeFromEndpointMethod<
    typeof octokit.rest.rateLimit.get
>;

export interface AnyGithubRestObject<T> {
    get: (params?: (RequestParameters & {}) | undefined) => Promise<T>
}

export interface RestResponse<T> {
    // biome-ignore lint/suspicious/noExplicitAny:
    error?: any;
    success?: boolean;
    data?: T;

    // ElysiaErrors
    server?: ElysiaErrors

    // GraphqlResponseError
    cause?: unknown;
    // biome-ignore lint/suspicious/noExplicitAny:
    path?: [any];
    type?: string | undefined;
}

export interface GraphqlResponse<T> extends RestResponse<T> { }

// in type GraphQlQueryResponse<ResponseData> of @octokit/graphql (has string as type...)
export enum GraphqlResponseErrorCode {
    NOT_FOUND = "NOT_FOUND",
}

/* ENDPOINTS */

export type PageSize<T> = {
    scopeName: T;
    pageSize: number;
    ContinueAfter?: string | null;
}

export enum GRAMMATICAL_NUMBER {
    SINGULAR = 1,
    PLURAL = 0,
}

export enum GITHUB_AUTHENTICATION_STRATEGY_OPTIONS {
    TOKEN = "TOKEN",
    APP = "APP"
}

/* SCOPES */

export enum GITHUB_ACCOUNT_SCOPES {
    INFO = "info",
    PACKAGES = "packages",
    PROJECTS = "projects",
    ESSENTIAL = "essential",
    ALL = "all"
}

export enum GITHUB_PROJECT_SCOPES {
    INFO = "info",
    REPOSITORIES_LINKED = "repositories"
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
    LANGUAGES = "languages",
    MILESTONES = "milestones",
    ISSUES = "issues",
    ALL = "all"
}

export enum GITHUB_MILESTONE_ISSUE_STATES {
    OPEN = "open",
    CLOSED = "closed"
}
