import { GraphqlResponseError } from "@octokit/graphql";
import { ParseError, NotFoundError, InternalServerError, Context } from "elysia";
import {
    GITHUB_AUTHENTICATION_STRATEGY_OPTIONS,
    GraphqlResponse,
    GraphqlResponseErrorCode
} from "../types";
import { GITHUB_API_HEADERS } from "../globals";
import { getOctokitObject } from "./authenticate";

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
            set.status = error.errors?.[0].type === GraphqlResponseErrorCode.NOT_FOUND ? 404 : 500;
            return { success: false, error: error.message, cause: error.cause, path: error.errors?.[0].path, type: error.errors?.[0].type };
        } else if (error instanceof InternalServerError || error instanceof ParseError || error instanceof NotFoundError) {
            set.status = error.status;
            return { success: false, error: error.status };
        } else {
            set.status = error?.status ?? 500;
            return { success: false, error: set.status };
        }
    }
}
