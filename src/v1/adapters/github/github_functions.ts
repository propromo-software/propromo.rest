import { GraphqlResponseError } from "@octokit/graphql"; // Testing GraphQL Queries: https://docs.github.com/en/graphql/overview/explorer
import { ParseError, NotFoundError, InternalServerError, Context } from "elysia"; // https://elysiajs.com/introduction.html
import { Octokit } from "octokit"; // { App } // https://github.com/octokit/octokit.js
// import { createAppAuth } from "@octokit/auth-app"; // https://github.com/octokit/octokit.js?tab=readme-ov-file#authentication
import {
    GITHUB_AUTHENTICATION_STRATEGY,
    GITHUB_AUTHENTICATION_STRATEGY_OPTIONS,
    GITHUB_MILESTONES_DEPTH,
    GITHUB_MILESTONE_ISSUE_STATES,
    GITHUB_REPOSITORY_SCOPES,
    GraphqlResponse,
    GraphqlResponseErrorCode
} from "./github_types";
import 'dotenv/config'; // process.env.<ENV_VAR_NAME>
import { octokitApp } from "./github_app";
import { GITHUB_API_HEADERS } from "./github_globals";

/**
 * Generates an Octokit object based on the provided authentication strategy and credentials.
 * @documentation https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation#using-octokitjs-to-authenticate-with-an-installation-id
 *
 * @param {GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null} authStrategy - The authentication strategy options or null
 * @param {string | null} auth - The authentication token or null
 * @return {Octokit | null} The Octokit object or null
 */
async function getOctokitObject(authStrategy: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null = null, auth: string | number | null): Promise<Octokit | null> {
    let octokitObject = null;

    if (typeof auth === "string" && (!authStrategy || authStrategy === GITHUB_AUTHENTICATION_STRATEGY.TOKEN(auth))) {
        octokitObject = new Octokit({ auth });
    } else if (authStrategy === GITHUB_AUTHENTICATION_STRATEGY.APP) {
        /* octokitObject = new Octokit({ // old method?
            authStrategy: createAppAuth,
            auth: {
                appId: process.env.GITHUB_APP_ID,
                privateKey: GITHUB_APP_PRIVATE_KEY,
                clientId: process.env.GITHUB_APP_CLIENT_ID,
                clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
                installationId: null
            }
        });

        octokitObject.auth({ type: 'app' }); */

        // const data = await octokitApp.octokit.rest.apps.getAuthenticated();
        // console.log(data);

        octokitObject = await octokitApp.getInstallationOctokit(auth as number); // get Installation by installationId
    } else {
        return null;
    }

    return octokitObject;
}

/**
 * Fetches Github data using GraphQL.
 *
 * @param {string} graphqlInput - the GraphQL query input
 * @param {string | undefined} auth - the authentication token
 * @param {Context["set"]} set - the context set function
 * @return {Promise<GraphqlResponse<T>>} a promise that resolves to a GraphQL response
 */
export async function fetchGithubDataUsingGraphql<T>(graphqlInput: string, auth: string | number | undefined | null, set: Context["set"], authStrategy: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null = null): Promise<GraphqlResponse<T>> {
    set.headers = { "Content-Type": "application/json" };

    if (auth === undefined) return { success: false, error: "No authentication token provided" };

    try {
        const octokit = await getOctokitObject(authStrategy, auth);
        if (!octokit) return { success: false, error: "Invalid authentication strategy" };

        const result = await octokit.graphql<T>(graphqlInput,
            {
                headers: {
                    ...GITHUB_API_HEADERS
                }
            }
        );

        return { success: true, data: result };
    } catch (error: any) { // don't catch ValidationError!
        if (error instanceof GraphqlResponseError) {
            // console.log(error); // .response

            set.status = error.errors?.[0].type === GraphqlResponseErrorCode.NOT_FOUND ? 404 : 500;
            return { success: false, error: error.message, cause: error.cause, path: error.errors?.[0].path, type: error.errors?.[0].type };
        } else if (error instanceof InternalServerError) {
            set.status = error.status;
            return { success: false, error: error.status };
        } else if (error instanceof ParseError) {
            set.status = error.status;
            return { success: false, error: error.status };
        } else if (error instanceof NotFoundError) {
            set.status = error.status;
            return { success: false, error: error.status };
        } else {
            set.status = error?.status ?? 500;
            return { success: false, error: set.status };
        }
    }
}

/**
 * Validates the view parameter and returns a number.
 *
 * @param {string | undefined} view_string - the view parameter to validate
 * @return {number} the validated view parameter as a number, or -1 if invalid
 */
export function validateViewParameter(view_string: string | undefined): number {
    if (view_string === undefined) return -1;
    if (view_string === "%7Bproject_view%7D") return -1;
    const view = Number(view_string);
    if (isNaN(view)) return -1;

    return view;
}

/**
 * Parses and validates the milestone depth and issue states from the given strings and sets the response status in the context.
 *
 * @param {string} depth_as_string - the string containing milestone depth values
 * @param {string} issueStates_as_string - the string containing issue states values
 * @param {Context["set"]} set - the context set object
 * @return {{ depth: GITHUB_MILESTONES_DEPTH[], issue_states: GITHUB_MILESTONE_ISSUE_STATES[] } | { success: boolean, error: string }} the parsed milestone depth and issue states or an error object
 */
export function parseMilestoneDepthAndIssueStates(depth_as_string: string, issueStates_as_string: string, set: Context["set"]): { depth: GITHUB_MILESTONES_DEPTH[], issue_states: GITHUB_MILESTONE_ISSUE_STATES[] } | { success: boolean, error: string } {
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

/**
 * Parses the provided repository scopes string and returns an array of GITHUB_REPOSITORY_SCOPES if successful, 
 * or an object with the success status and error message if invalid scope values are provided.
 *
 * @param {string} repository_scopes_as_string - The string containing repository scope values
 * @param {Context["set"]} set - The set context object
 * @return {GITHUB_REPOSITORY_SCOPES[] | { success: boolean, error: string }} The parsed repository scopes array or an object with success and error message
 */
export function parseScopedRepositories(repository_scopes_as_string: string, set: Context["set"]): GITHUB_REPOSITORY_SCOPES[] | { success: boolean, error: string } {
    const scope_values = repository_scopes_as_string.split(',');
    const scope_values_are_of_valid_enum_type = isValidEnumArray(scope_values, Object.values(GITHUB_REPOSITORY_SCOPES));

    if (!scope_values_are_of_valid_enum_type) {
        set.status = 400;
        return { success: false, error: 'Invalid scope values' };
    }

    const scope = scope_values as GITHUB_REPOSITORY_SCOPES[];
    return scope;
}

/**
 * Checks if all elements in the array are valid enum values.
 *
 * @param {string[]} array - the array to be checked
 * @param {string[]} enumValues - the valid enum values
 * @return {boolean} true if all elements in the array are valid enum values, false otherwise
 */
export function isValidEnumArray(array: string[], enumValues: string[]): boolean {
    for (let i = 0; i < array.length; i++) {
        if (!enumValues.includes(array[i])) {
            return false;
        }
    }
    return true;
}
