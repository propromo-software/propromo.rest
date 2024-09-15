import { GraphqlResponseError } from "@octokit/graphql";
import {
	ParseError,
	NotFoundError,
	InternalServerError,
	type Context,
} from "elysia";
import {
	GITHUB_AUTHENTICATION_STRATEGY_OPTIONS,
	type GetRateLimit,
	type GraphqlResponse,
	GraphqlResponseErrorCode,
	type RestResponse,
} from "../types";
import { GITHUB_API_HEADERS } from "../globals";
import { getOctokitObject } from "./authenticate";
import type { OctokitResponse } from "@octokit/types";
import { MicroserviceError } from "../../error";
import { DEV_MODE, OPEN_SOURCE_PROGRAM_PATS } from "../../../../environment";

/**
 * Asynchronously checks each token in OPEN_SOURCE_PROGRAM_PATS to see if the rate limit for GraphQL requests is greater than 0.
 * If a token is found with a remaining rate limit greater than 0, it is returned. Otherwise, null is returned.
 *
 * @param {Context["set"]} set - The context set object.
 * @return {Promise<string | null>} The first token with a remaining rate limit greater than 0, or null if no such token is found.
 */
async function useOpenSourceProgram(
	set: Context["set"],
): Promise<string | null> {
	// maybe improve efficiency, if the token array gets bigger
	for (const token of OPEN_SOURCE_PROGRAM_PATS) {
		try {
			const rateLimitResponse = await fetchRateLimit(token, set);
			if (DEV_MODE)
				console.log("useOpenSourceProgram", token, rateLimitResponse);

			if (
				(rateLimitResponse.data?.data?.resources?.graphql?.remaining ?? 0) > 0
			) {
				return token;
			}
		} catch {
			console.error("useOpenSourceProgram, token is invalid", token);
		}
	}

	return null;
}

/**
 * Checks if the open source program is available by trying to fetch a token from the list of available tokens.
 * If a token is found with a remaining rate limit greater than 0, it is returned.
 * Otherwise, a 500 error is thrown indicating that the open source program is currently under high load.
 *
 * @param {Context["set"]} set - The context set object.
 * @return {Promise<string>} The token used to authenticate the request.
 * @throws {MicroserviceError} If the open source program is under high load.
 */
async function checkIfOpenSourceProgramIsAvailable(
	set: Context["set"],
): Promise<string> {
	const token = await useOpenSourceProgram(set);

	if (!token) {
		set.status = 500;
		throw new MicroserviceError({
			error:
				"Open source program is currently under high load. Please try again later.",
			code: 500,
		});
	}

	return token;
}

/**
 * Fetches the rate limit using the provided authentication and context set.
 *
 * @param {string | number} auth - The authentication token or ID.
 * @param {Context["set"]} set - The context set object.
 * @return {Promise<RestResponse<GetRateLimit>>} A promise that resolves to a RestResponse containing the rate limit information.
 */
export async function fetchRateLimit(
	auth: string | number,
	set: Context["set"],
): Promise<RestResponse<GetRateLimit>> {
	const authentication =
		auth === "use-open-source-program"
			? await checkIfOpenSourceProgramIsAvailable(set)
			: auth;
	if (DEV_MODE) console.log("fetchGithubRateLimit", authentication);

	const octokit = await getOctokitObject(
		GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.TOKEN,
		authentication,
		set,
	);

	return tryFetch<GetRateLimit>(() => octokit.rest.rateLimit.get(), set);
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
export async function fetchGithubDataUsingRest(
	path: string,
	auth: string | number | undefined | null,
	set: Context["set"],
	authStrategy: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null = null,
	// biome-ignore lint/suspicious/noExplicitAny: Can be any
): Promise<RestResponse<OctokitResponse<any, number>>> {
	const authentication =
		auth === "use-open-source-program"
			? await checkIfOpenSourceProgramIsAvailable(set)
			: auth;
	if (DEV_MODE)
		console.log("fetchGithubDataUsingRest", path, authentication, authStrategy);

	if (authentication === undefined) {
		set.status = 400;
		throw new MicroserviceError({
			error: "No authentication token provided",
			code: 400,
		});
	}

	const octokit = await getOctokitObject(authStrategy, authentication, set);
	if (!octokit) {
		set.status = 400;
		throw new MicroserviceError({
			error: "Invalid authentication strategy",
			code: 400,
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny:
	return tryFetch<OctokitResponse<any, number>>(
		() => octokit.request(path),
		set,
		"Invalid path provided.",
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
export async function fetchGithubDataUsingGraphql<T>(
	graphqlInput: string,
	auth: string | number | undefined | null,
	set: Context["set"],
	authStrategy: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null = null,
): Promise<GraphqlResponse<T>> {
	const authentication =
		auth === "use-open-source-program"
			? await checkIfOpenSourceProgramIsAvailable(set)
			: auth;
	if (DEV_MODE)
		console.log(
			"fetchGithubDataUsingGraphql",
			graphqlInput,
			authentication,
			authStrategy,
		);

	if (authentication === undefined) {
		set.status = 400;
		throw new MicroserviceError({
			error: "No authentication token provided",
			code: 400,
		});
	}
	const octokit = await getOctokitObject(authStrategy, authentication, set);

	return tryFetch<T>(
		() =>
			octokit.graphql<T>(graphqlInput, {
				headers: {
					...GITHUB_API_HEADERS,
				},
			}),
		set,
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
	errorMessage = "An error occurred while fetching data.",
): Promise<RestResponse<T> | GraphqlResponse<T>> => {
	set.headers = { "Content-Type": "application/json" };

	try {
		const result = await fetchFunction();
		if (DEV_MODE) console.log("fetchFunctionResult", result);

		return { success: true, data: result };
		// biome-ignore lint/suspicious/noExplicitAny:
	} catch (error: any) {
		if (error instanceof GraphqlResponseError) {
			set.status =
				error.errors?.[0].type === GraphqlResponseErrorCode.NOT_FOUND
					? 404
					: 500;

			throw new MicroserviceError({
				error: error.message,
				code: set.status,
				info: {
					cause: error.cause,
					path: error.errors?.[0].path,
					type: error.errors?.[0].type,
				},
			});
		}
		if (
			error instanceof InternalServerError ||
			error instanceof ParseError ||
			error instanceof NotFoundError
		) {
			set.status = error.status;
			throw new MicroserviceError({
				error: "Something went horrible wrong.",
				code: error.status,
			});
		}

		set.status = error?.status ?? 500;
		throw new MicroserviceError({ error: errorMessage, code: error.status });
	}
};
