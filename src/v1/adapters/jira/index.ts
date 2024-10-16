import { Elysia } from "elysia";
import { guardEndpoints } from "../plugins";
import { RESOLVE_JWT } from "./functions/authenticate";
import { fetchGraphqlEndpointUsingBasicAuth } from "../fetch";
import { JIRA_CLOUD_PROJECTS } from "./scopes";
import type { tenantContexts } from "./types";

/* GENERAL */

/**
 * Used for fetching info from the Jira GraphQl API. (quota and other general infos)
 */
export const JIRA_GENERAL = new Elysia({ prefix: "/info" }).use(
	guardEndpoints(
		new Elysia().group("cloud", (app) =>
			app.use(RESOLVE_JWT).group("/:cloud_id", (app) =>
				app.get(
					"/projects",
					async ({ params, fetchParams, set }) => {
						const tokenParts = fetchParams.auth.split(" ");
						const host = tokenParts[0];
						const tokenAuth = tokenParts[1].split(":");
						const auth = { user: tokenAuth[0], secret: tokenAuth[1] };
						const response =
							await fetchGraphqlEndpointUsingBasicAuth<tenantContexts>(
								JIRA_CLOUD_PROJECTS(params.cloud_id, { types: ["Software"] }),
								host,
								auth,
								set,
							);

						return response;
					},
					{
						detail: {
							description:
								"Get a list of all projects that are accessible to the authenticated user.",
							tags: ["jira"],
						},
					},
				),
			),
		),
	),
);
