import { type Context, Elysia, t } from "elysia";
import jwt from "@elysiajs/jwt";
import { octokitApp } from "./app";
import { Octokit } from "octokit";
import { GITHUB_AUTHENTICATION_STRATEGY_OPTIONS } from "../types";
import bearer from "@elysiajs/bearer";
import { fetchGithubDataUsingGraphql } from "./fetch";
import type { RateLimit } from "@octokit/graphql-schema";
import { GITHUB_QUOTA } from "../graphql";
import { maybeStringToNumber } from "../../parse";
import { DEV_MODE, JWT_SECRET } from "../../../../environment";
import { MicroserviceError } from "../../error";
import { decryptString, encryptString } from "../../crypto";
import { checkForTokenPresence } from "../../authenticate";

/* JWT */

export const GITHUB_JWT_REALM = "propromoRestAdaptersGithub";

export const GITHUB_JWT = new Elysia().use(
	jwt({
		name: GITHUB_JWT_REALM,
		secret: JWT_SECRET,
		alg: "HS256" /* alt: RS256 */,
		iss: "propromo",
		/* schema: t.Object({ // not working properly (probably the auth parameter)
				auth_type: t.Enum(GITHUB_AUTHENTICATION_STRATEGY_OPTIONS),
				auth: t.Union([t.String(), t.Number()]) // token or installation_id
			}) */
	}),
);

/**
 * Check if the provided token is valid by fetching Github data using GraphQL.
 *
 * @param {string | number} token - The token to be checked.
 * @param {Context["set"]} set - The context set object.
 * @return {Promise<boolean>} Returns true if the token is valid.
 */
export async function checkIfTokenIsValid(
	token: string | number,
	set: Context["set"],
): Promise<boolean> {
	if (token === "use-open-source-program") return true;

	const response = await fetchGithubDataUsingGraphql<
		{ rateLimit: RateLimit } | undefined | null
	>(GITHUB_QUOTA, token, set);

	if (!response.success || response?.data === undefined) {
		set.status = 401;
		set.headers["WWW-Authenticate"] =
			`Bearer realm='${GITHUB_JWT_REALM}', error="invalid_bearer_token"`;

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
	.use(GITHUB_JWT)
	.resolve(
		{ as: "scoped" },
		async ({ propromoRestAdaptersGithub, headers: { authorization }, set }) => {
			const bearer = authorization?.split(" ")[1];
			const token = checkForTokenPresence(bearer, set);

			const jwt = await propromoRestAdaptersGithub.verify(token);
			if (DEV_MODE) console.log(jwt);

			if (!jwt) {
				set.status = 401;
				set.headers["WWW-Authenticate"] =
					`Bearer realm='${GITHUB_JWT_REALM}', error="bearer_token_invalid"`;

				throw new MicroserviceError({
					error:
						"Unauthorized. Authentication token is missing or invalid. Please provide a valid token. Tokens can be obtained from the `/auth/app|token` endpoints.",
					code: 401,
				});
			}

			const patToken = await decryptString(String(jwt.auth));
			if (DEV_MODE) console.log("decryptedToken:", patToken);

			return {
				fetchParams: {
					auth_type: jwt.auth_type as GITHUB_AUTHENTICATION_STRATEGY_OPTIONS,
					auth: patToken,
				},
			};
		},
	);

/* APP AND TOKEN AUTHENTICATION */

export const GITHUB_AUTHENTICATION = new Elysia({ prefix: "/auth" })
	.use(bearer())
	.use(GITHUB_JWT)
	.post(
		"/app",
		async ({ body, propromoRestAdaptersGithub }) => {
			const auth = maybeStringToNumber(body?.installation_id); // bearer is checked beforeHandle

			const token = await encryptString(auth as string);
			if (DEV_MODE) console.log("encryptedToken", token);

			const bearerToken = await propromoRestAdaptersGithub.sign({
				auth_type: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.APP,
				auth: token,
				iat: Math.floor(Date.now() / 1000) - 60,
				/* exp: Math.floor(Date.now() / 1000) + (10 * 60) */
			});

			return bearerToken;
		},
		{
			async beforeHandle({ body, set }) {
				// checkForTokenPresence
				if (
					!body.code ||
					!body.installation_id ||
					!body.setup_action ||
					body.setup_action !== "install"
				) {
					set.status = 400;
					set.headers["WWW-Authenticate"] =
						`Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`;

					throw new MicroserviceError({
						error:
							"App installation is missing. Install it at https://github.com/apps/propromo-software/installations/new.",
						code: 400,
					});
				}

				const valid = await checkIfTokenIsValid(body.installation_id, set);
				if (DEV_MODE)
					console.log("JWT:", body.installation_id, "Valid:", valid);
			},
			body: t.Object({
				code: t.Optional(
					t.String({
						minLength: 1,
					}),
				),
				installation_id: t.Optional(
					t.Numeric({
						minLength: 1,
					}),
				),
				setup_action: t.Const("install"),
			}),
			detail: {
				description: "Authenticate using a GitHub App.",
				tags: ["github", "authentication"],
			},
		},
	)
	.post(
		"/token",
		async ({ propromoRestAdaptersGithub, bearer }) => {
			const auth = maybeStringToNumber(bearer); // bearer is checked beforeHandle

			const token = await encryptString(auth as string);
			if (DEV_MODE) console.log("encryptedToken", token);

			const bearerToken = await propromoRestAdaptersGithub.sign({
				auth_type: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.TOKEN,
				auth: token,
				iat: Math.floor(Date.now() / 1000) - 60,
				/* exp: Math.floor(Date.now() / 1000) + (10 * 60) */
			});

			return bearerToken;
		},
		{
			async beforeHandle({ bearer, set }) {
				const token = checkForTokenPresence(bearer, set);
				const valid = await checkIfTokenIsValid(token, set);
				if (DEV_MODE) console.log("decryptedToken:", token, "| valid:", valid);
			},
			detail: {
				description: "Authenticate using a GitHub PAT.",
				tags: ["github", "authentication"],
			},
		},
	);

/* APP */

/**
 * Generates an Octokit object based on the provided authentication strategy and credentials.
 * @documentation https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation#using-octokitjs-to-authenticate-with-an-installation-id
 */
export async function getOctokitObject(
	authStrategy: GITHUB_AUTHENTICATION_STRATEGY_OPTIONS | null,
	auth: string | number | null,
	set: Context["set"],
) {
	if (
		typeof auth === "string" &&
		(!authStrategy ||
			authStrategy === GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.TOKEN)
	) {
		return new Octokit({ auth });
	}
	if (authStrategy === GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.APP) {
		return await octokitApp.getInstallationOctokit(auth as number); // get Installation by installationId
	}

	set.status = 400;
	throw new MicroserviceError({
		error: "Invalid authentication strategy",
		code: 400,
	});
}
