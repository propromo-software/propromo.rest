import { type Context, Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import bearer from "@elysiajs/bearer";
import { DEV_MODE, JWT_SECRET } from "../../../../environment";
import { MicroserviceError } from "../../error";
import { decryptString, encryptString } from "../../crypto";
import { checkForTokenPresence } from "../../authenticate";
import { JIRA_CLOUD_ID } from "../scopes";
import { fetchGraphqlEndpointUsingBasicAuth } from "../../fetch";
import { JIRA_AUTHENTICATION_STRATEGY_OPTIONS, tenantContexts } from "../types";
import { validateBasicAuthenticationInput } from "./validate";

/* JWT */

export const JIRA_JWT_REALM = "propromoRestAdaptersJira";

export const JIRA_JWT = new Elysia().use(
	jwt({
		name: JIRA_JWT_REALM,
		secret: JWT_SECRET,
		alg: "HS256",
		iss: "propromo",
	}),
);

/**
 * Checks if the provided token is valid by querying the Jira Cloud API.
 *
 * @param host - The Jira Cloud instance to query.
 * @param {user, secret} - The credentials to use for authentication.
 * @param set - The context set function.
 * @return {Promise<boolean>} A promise that resolves to true if the token is valid, or throws an error if it is not.
 * @throws {MicroserviceError} If the token is invalid or has expired.
 */
export async function checkIfTokenIsValid(
	host: string,
	auth: { user: string; secret: string },
	set: Context["set"],
): Promise<boolean> {
	const response = await fetchGraphqlEndpointUsingBasicAuth<{
		tenantContexts?: { cloudId?: string } | null;
	}>(JIRA_CLOUD_ID([host]), host, auth, set);

	if (response?.data?.tenantContexts === null) {
		set.status = 401;
		set.headers["WWW-Authenticate"] =
			`Bearer realm='${JIRA_JWT_REALM}', error="invalid_bearer_token"`;

		throw new MicroserviceError({
			error:
				"The provided token is invalid or has expired. Please try another token. Perhaps you chose the wrong provider?",
			code: 401,
			info: response?.error,
		});
	}

	return true;
}

export const RESOLVE_JWT = new Elysia()
	.use(JIRA_JWT)
	.resolve(
		{ as: "scoped" },
		async ({ propromoRestAdaptersJira, headers: { authorization }, set }) => {
			const bearer = authorization?.split(" ")[1];
			const token = checkForTokenPresence(
				bearer,
				set,
				JIRA_JWT_REALM,
				"Token is missing. Create one at https://id.atlassian.com/manage-profile/security/api-tokens.",
			);

			const jwt = await propromoRestAdaptersJira.verify(token);
			if (DEV_MODE) console.log(jwt);

			if (!jwt) {
				set.status = 401;
				set.headers["WWW-Authenticate"] =
					`Bearer realm='${JIRA_JWT_REALM}', error="bearer_token_invalid"`;

				throw new MicroserviceError({
					error:
						"Unauthorized. Authentication token is missing or invalid. Please provide a valid token. Tokens can be obtained from the `/auth/basic` endpoint.",
					code: 401,
				});
			}

			const patToken = await decryptString(String(jwt.auth));
			if (DEV_MODE) console.log("decryptedToken:", patToken);

			return {
				fetchParams: {
					auth_type: jwt.auth_type as JIRA_AUTHENTICATION_STRATEGY_OPTIONS,
					auth: patToken,
				},
			};
		},
	);

/* APP AND TOKEN AUTHENTICATION */

export const JIRA_AUTHENTICATION = new Elysia({ prefix: "/auth" })
	.use(bearer())
	.use(JIRA_JWT)
	.post(
		"/basic",
		async ({ propromoRestAdaptersJira, bearer, set }) => {
			const auth = bearer as string; // bearer is checked beforeHandle

			const token = await encryptString(auth);
			if (DEV_MODE) console.log("encryptedToken", token);

			const bearerToken = await propromoRestAdaptersJira.sign({
				auth_type: JIRA_AUTHENTICATION_STRATEGY_OPTIONS.BASIC,
				auth: token,
				iat: Math.floor(Date.now() / 1000) - 60,
				/* exp: Math.floor(Date.now() / 1000) + (10 * 60) */
			});

			const { host, user, secret } = validateBasicAuthenticationInput(auth);
			const jiraCloudContext =
				await fetchGraphqlEndpointUsingBasicAuth<tenantContexts>(
					JIRA_CLOUD_ID([host]),
					host,
					{ user: user, secret: secret },
					set,
				);

			return {
				bearer: bearerToken,
				context: {
					cloudId: jiraCloudContext?.data?.tenantContexts
						? jiraCloudContext?.data?.tenantContexts[0]?.cloudId
						: -1,
				},
			};
		},
		{
			async beforeHandle({ bearer, set }) {
				const token = checkForTokenPresence(
					bearer,
					set,
					JIRA_JWT_REALM,
					"Token is missing. Create one at https://id.atlassian.com/manage-profile/security/api-tokens.",
				);

				// [<Host> <E-Mail>:<API-Token>]
				const format = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}:[A-Za-z0-9-=_]+$/;
				const isValidFormat = format.test(token);

				if (!isValidFormat) {
					set.status = 400;

					throw new MicroserviceError({
						error: "The authentication format is not valid. The easiest way to authenticate with Jira's REST-API is, with basic authentication. The format you have to provide us is the following: [<Host> <E-Mail>:<API-Token>].",
						code: 400,
					});
				}

				const { host, user, secret } = validateBasicAuthenticationInput(token);
				const valid = await checkIfTokenIsValid(
					host,
					{ user, secret },
					set,
				);
				if (DEV_MODE) console.log("decryptedToken:", token, "| valid:", valid);
			},
			detail: {
				description:
					"Authenticate using your Jira Host, E-Mail and API-Token [<Host> <E-Mail>:<API-Token>]. (basic authentication).",
				tags: ["jira", "authentication"],
			},
		},
	);
