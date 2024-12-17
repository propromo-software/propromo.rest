import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

import {
	SWAGGER_PATH,
	ROOT_PATHS,
	SWAGGER_PATH_EXCLUDE,
	V1_PATH,
} from "../config";
import {
	GITHUB_APP_WEBHOOKS,
	GITHUB_GENERAL,
	GITHUB_ORGS,
	GITHUB_USERS,
} from "./adapters/github";
import { GITHUB_AUTHENTICATION } from "./adapters/github/functions/authenticate";
import { JIRA_AUTHENTICATION } from "./adapters/jira/functions/authenticate";
import { JIRA_GENERAL } from "./adapters/jira";

export const v1 = new Elysia({ prefix: `/${V1_PATH}` })
	.group("/github", (app) =>
		app
			.use(GITHUB_AUTHENTICATION)
			.use(GITHUB_APP_WEBHOOKS)
			.use(GITHUB_GENERAL)
			.use(GITHUB_ORGS)
			.use(GITHUB_USERS),

		// Set default in endpoints: 
		/* {
			detail: { security: [{ BearerAuth: [] }] }
		} */
	)
	.group("/jira", (app) => app.use(JIRA_AUTHENTICATION).use(JIRA_GENERAL))
	.use(
		swagger({
			/* Stable: 1.17.16 */
			/* Modern UI: 1.25.25, 1.25.58, 1.25.68 */
			scalarVersion: "1.25.83", // https://github.com/scalar/scalar/issues/3956
			path: SWAGGER_PATH,
			exclude: [
				...ROOT_PATHS,
				...SWAGGER_PATH_EXCLUDE,
				// biome-ignore lint/complexity/useRegexLiterals:
				new RegExp("(/github/webhooks/)[A-Za-z/{_}]*"),
			],
			documentation: {
				info: {
					title: "Propromo RestAPI Documentation",
					description:
						"A RestAPI for the scopes of the Github GraphqlAPI, that Propromo needs (latest).",
					version: "1.2.0",
				},
				tags: [
					{
						name: "github",
						description: "Used for fetching info from the Github GraphQl API.",
					},
					{
						name: "jira",
						description: "Used for fetching info from the Jira GraphQl API.",
					},
					{
						name: "authentication",
						description:
							"Authenticate here first, to send requests to protected endpoints.",
					},
				],
				components: {
					securitySchemes: {
						BearerAuth: {
							type: 'http',
							scheme: 'bearer',
							bearerFormat: 'JWT',
						},
					},
				},
			},
			scalarConfig: {
				metaData: {
					ogImage: {
						url: "http://localhost:3000/favicon.png",
						secureUrl: "https://rest-microservice.onrender.com/favicon.png",
						type: "image/png",
						width: 512,
						height: 512,
						alt: "favicon",
					},
				},
				authentication: {
					preferredSecurityScheme: 'BearerAuth',
				},
			},
		}),
	);
