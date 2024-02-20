import { GraphqlResponseError } from "@octokit/graphql"; // Testing GraphQL Queries: https://docs.github.com/en/graphql/overview/explorer
import { ParseError, NotFoundError, InternalServerError, Context } from "elysia"; // https://elysiajs.com/introduction.html
import { Octokit } from "octokit"; // { App } // https://github.com/octokit/octokit.js
import { GITHUB_MILESTONES_DEPTH, GITHUB_MILESTONE_ISSUE_STATES, GITHUB_REPOSITORY_SCOPES, GraphqlResponse, GraphqlResponseErrorCode } from "./github_types";

export async function fetchGithubDataUsingGraphql<T>(graphqlInput: string, auth: string | undefined, set: Context["set"]): Promise<GraphqlResponse<T>> {
    set.headers = { "Content-Type": "application/json" };

    try {
        const octokit = new Octokit({ auth });
        const result = await octokit.graphql<T>(graphqlInput);

        return { success: true, data: result };
    } catch (error: any) { // don't catch ValidationError!
        if (error instanceof GraphqlResponseError) {
            // console.log(error); // .response

            set.status = error.errors?.[0].type === GraphqlResponseErrorCode.NOT_FOUND ? 404 : 500;
            return { success: false, error: error.message, cause: error.cause, path: error.errors?.[0].path, type: error.errors?.[0].type };
        } else if (error instanceof InternalServerError) {
            set.status = error.status;
            return { success: false, error: error.status  };
        } else if (error instanceof ParseError) {
            set.status = error.status;
            return { success: false, error: error.status  };
        } else if (error instanceof NotFoundError) {
            set.status = error.status;
            return { success: false, error: error.status  };
        } else {
            set.status = error?.status ?? 500;
            return { success: false, error: error?.status  };
        }
    }
}

export function validateViewParameter(view_string: string | undefined): number {
    if (view_string === undefined) return -1;
    if (view_string === "%7Bproject_view%7D") return -1;
    const view = Number(view_string);
    if (isNaN(view)) return -1;

    return view;
}

export function parseMilestoneDepthAndIssueStates(depth_as_string: string, issueStates_as_string: string, set: Context["set"] ): { depth: GITHUB_MILESTONES_DEPTH[], issue_states: GITHUB_MILESTONE_ISSUE_STATES[]} | { success: boolean, error: string } {
    const depth_values = depth_as_string.split(',');
    const depth_values_are_of_valid_enum_type = isValidEnumArray(depth_values, Object.values(GITHUB_MILESTONES_DEPTH));
    const issue_states_values = issueStates_as_string.split(',');
    const issue_states_values_are_of_valid_enum_type = isValidEnumArray(issue_states_values, Object.values(GITHUB_MILESTONE_ISSUE_STATES));

    if (!depth_values_are_of_valid_enum_type) {
        set.status = 400;
        return { success: false, error: 'Invalid `depth` values' };
    }

    if (!issue_states_values_are_of_valid_enum_type) {
        set.status = 400;
        return { success: false, error: 'Invalid `issue_states` values' };
    }

    const depth = depth_values as GITHUB_MILESTONES_DEPTH[];
    const issue_states = issue_states_values as GITHUB_MILESTONE_ISSUE_STATES[];

    return {
        depth,
        issue_states
    };
}

export function parseScopedRepositories(repository_scopes_as_string: string, set: Context["set"] ): GITHUB_REPOSITORY_SCOPES[] | { success: boolean, error: string } {
    const scope_values = repository_scopes_as_string.split(',');
    const scope_values_are_of_valid_enum_type = isValidEnumArray(scope_values, Object.values(GITHUB_REPOSITORY_SCOPES));

    if (!scope_values_are_of_valid_enum_type) {
        set.status = 400;
        return { success: false, error: 'Invalid scope values' };
    }

    const scope = scope_values as GITHUB_REPOSITORY_SCOPES[];
    return scope;
}

export function isValidEnumArray(array: string[], enumValues: string[]): boolean {
    for (let i = 0; i < array.length; i++) {
        if (!enumValues.includes(array[i])) {
            return false;
        }
    }
    return true;
}
