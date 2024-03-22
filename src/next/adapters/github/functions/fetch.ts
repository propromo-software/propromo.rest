import { GraphqlResponseError } from "@octokit/graphql";
import { ParseError, NotFoundError, InternalServerError, type Context } from "elysia";
import {
    GITHUB_AUTHENTICATION_STRATEGY_OPTIONS,
    type GetRateLimit,
    type GraphqlResponse,
    GraphqlResponseErrorCode,
    type RestResponse
} from "../types";
import { GITHUB_API_HEADERS } from "../globals";
import { getOctokitObject } from "./authenticate";
import type { OctokitResponse } from "@octokit/types";

/**
 * Fetches the rate limit using the provided authentication and context set.
 *
 * @param {string | number} auth - The authentication token or ID.
 * @param {Context["set"]} set - The context set object.
 * @return {Promise<RestResponse<GetRateLimit>>} A promise that resolves to a RestResponse containing the rate limit information.
 */
export async function fetchRateLimit(auth: string | number, set: Context["set"]): Promise<RestResponse<GetRateLimit>> {
    const octokit = await getOctokitObject(
        GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.TOKEN,
        auth
    );

    if (!octokit)
        return { success: false, error: "Invalid authentication strategy" };

    return tryFetch<GetRateLimit>(
        () => octokit.rest.rateLimit.get(),
        set
    );
}

/**
 * Fetches GitHub data using the REST API.
 *
 * @param {string} path - the path for the request
 * @param {string | number | undefined | null} auth - the authentication token
 * @param {Context["set"]} set - the context set function
 * @param {GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null} authStrategy - the authentication strategy, defaults to null
 * @return {Promise<RestResponse<OctokitResponse<any, number>>} a promise that resolves to the REST response
 */
// biome-ignore lint/suspicious/noExplicitAny:
export async function fetchGithubDataUsingRest(path: string, auth: string | number | undefined | null, set: Context["set"], authStrategy: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null = null): Promise<RestResponse<OctokitResponse<any, number>>> {
    if (auth === undefined) return { success: false, error: "No authentication token provided" };
    const octokit = await getOctokitObject(authStrategy, auth);
    if (!octokit) return { success: false, error: "Invalid authentication strategy" };

    // biome-ignore lint/suspicious/noExplicitAny:
    return tryFetch<OctokitResponse<any, number>>(
        () => octokit.request(path),
        set,
        "Invalid path provided."
    );
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
    if (auth === undefined) return { success: false, error: "No authentication token provided" };
    const octokit = await getOctokitObject(authStrategy, auth);
    if (!octokit) return { success: false, error: "Invalid authentication strategy" };

    return tryFetch<T>(
        () => octokit.graphql<T>(graphqlInput, {
            headers: {
                ...GITHUB_API_HEADERS
            }
        }),
        set
    );
}

/**
 * Fetches data from a given function and returns a response.
 *
 * @param {() => Promise<T>} fetchFunction - the function to fetch data
 * @param {Context["set"]} set - the context set function
 * @param {string} errorMessage - the error message to display
 * @return {Promise<RestResponse<T> | GraphqlResponse<T>>} a promise that resolves to a response
 */
const tryFetch = async <T>(
    fetchFunction: () => Promise<T>,
    set: Context["set"],
    errorMessage = "An error occurred while fetching data."
): Promise<RestResponse<T> | GraphqlResponse<T>> => {
    set.headers = { "Content-Type": "application/json" };

    try {
        const result = await fetchFunction();

        return { success: true, data: result };
        // biome-ignore lint/suspicious/noExplicitAny:
    } catch (error: any) {
        if (error instanceof GraphqlResponseError) {
            set.status = error.errors?.[0].type === GraphqlResponseErrorCode.NOT_FOUND ? 404 : 500;
            return {
                success: false,
                error: error.message,
                cause: error.cause,
                path: error.errors?.[0].path,
                type: error.errors?.[0].type,
            };
        } if (
            error instanceof InternalServerError ||
            error instanceof ParseError ||
            error instanceof NotFoundError
        ) {
            set.status = error.status;
            return { success: false, error: error.status };
        }

        set.status = error?.status ?? 500;
        return { success: false, error: errorMessage };
    }
};
