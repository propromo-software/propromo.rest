import { Elysia } from "elysia";
import { guardEndpoints } from "../plugins";
import { RESOLVE_JWT } from "./functions/authenticate";
import { fetchGraphqlEndpointUsingBasicAuth } from "../fetch";
import { validateBasicAuthenticationInput } from "./functions/validate";
import { JIRA_CLOUD_PROJECTS } from "./scopes";
import type { tenantContexts } from "./types";

/* GENERAL */

/**
 * Used for fetching info from the Jira GraphQl API. (quota and other general infos)
 * 
 * **Example Response** for the `allJiraProjects` query:
 * ```
 * {
 * "data": {
 *	  "__typename": "JiraQuery",
 *	  "jira": {
 *	    "allJiraProjects": {
 *	  	"__typename": "JiraProjectConnection",
 *	  	"pageInfo": {
 *	  	  "__typename": "PageInfo",
 *	  	  "hasNextPage": false
 *	  	},
 *	  	"edges": [
 *	  	  {
 *	  		"__typename": "JiraProjectEdge",
 *	  		"node": {
 *	  		  "__typename": "JiraProject",
 *	  		  "id": "ari:cloud:jira:fa25cc28-217d-448e-aa38-ebe727051ae1:project/10000",
 *	  		  "key": "SCRUM",
 *	  		  "name": "SCRUM",
 *	  		  "description": "",
 *	  		  "avatar": {
 *	  			"__typename": "JiraAvatar",
 *	  			"large": "https://propromo.atlassian.net/rest/api/2/universal_avatar/view/type/project/avatar/10416"
 *	  		  },
 *	  		  "webUrl": "https://propromo.atlassian.net/browse/SCRUM",
 *	  		  "status": "ACTIVE",
 *	  		  "created": "2024-11-06T23:57:50.781255Z",
 *	  		  "lastUpdated": "2024-11-07T00:46:29.237Z",
 *	  		  "projectType": "SOFTWARE",
 *	  		  "projectTypeName": "Software project"
 *	  		}
 *	  	  }
 *	  	]
 *	    }
 *	  }
 * },
 * "loading": false,
 * "networkStatus": 7
 * }
 * ```
 */
export const JIRA_GENERAL = new Elysia({ prefix: "/info" }).use(
	guardEndpoints(
		new Elysia().group("cloud", (app) =>
			app.use(RESOLVE_JWT).group("/:cloud_id", (app) =>
				app.get(
					"/projects/software",
					async ({ params, fetchParams, set }) => {
						const { host, user, secret } = validateBasicAuthenticationInput(fetchParams.auth);

						const response =
							await fetchGraphqlEndpointUsingBasicAuth<tenantContexts>(
								JIRA_CLOUD_PROJECTS(params.cloud_id, { types: ["Software"] }),
								host,
								{ user, secret },
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
