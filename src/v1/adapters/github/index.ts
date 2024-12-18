import type {
	Organization,
	ProjectV2,
	RateLimit,
	User,
} from "@octokit/graphql-schema";
import { Elysia, t } from "elysia";
import {
	AccountScopeEntryRoot,
	GITHUB_QUOTA,
	Project,
	getAllRepositoriesInProject,
} from "./graphql";
import { fetchGithubDataUsingGraphql, fetchRateLimit } from "./functions/fetch";
import { createPinoLogger } from "@bogeychan/elysia-logger";
import { getOctokitObject, RESOLVE_JWT } from "./functions/authenticate";
import { guardEndpoints } from "../plugins";
import {
	GITHUB_ACCOUNT_SCOPES,
	GITHUB_AUTHENTICATION_STRATEGY_OPTIONS,
	GITHUB_MILESTONE_ISSUE_STATES,
	GITHUB_PROJECT_SCOPES,
	GITHUB_REPOSITORY_SCOPES,
	GRAMMATICAL_NUMBER,
	type PageSize,
} from "../github/types";
import {
	GITHUB_ACCOUNT_PARAMS,
	GITHUB_PROJECT_PARAMS,
	GITHUB_REPOSITORY_PARAMS,
} from "./params";
import { OrganizationFetcher, Repository, UserFetcher } from "./scopes";
import { parseScopes } from "./functions/parse";
import { maybeStringToNumber } from "../parse";
import type { ProjectsV2ItemEvent, WebhookEventMap } from "@octokit/webhooks-types";
import { handleProjectItemChange } from "./functions/mutations";
import { DEV_MODE } from "../../../environment";

const log = createPinoLogger();
// TODO: write tests for all endpoints

/* APP WEBHOOK */

/**
 * Receives a webhook event of the changes that happened in the scopes that this microservice is subscribed to, on the GitHub-App installation.
 * 
 * Needs `issues: write` for extended functionality. (Automatically creating labels and adding them to issues.)
 */
export const GITHUB_APP_WEBHOOKS = new Elysia({ prefix: "/webhooks" }).post(
	"",
	async (ctx) => {
		const child = log.child(ctx);
        if (DEV_MODE) child.info("webhook received");
		
		const eventType = ctx.headers["x-github-event"] as keyof WebhookEventMap;
		
		if (eventType === "projects_v2_item") {
			if (DEV_MODE) log.info("projects_v2_item webhook received");

			const payload = ctx.body as ProjectsV2ItemEvent;
			
			if (
				(payload.action === "edited" || payload.action === "created" || payload.action === "converted" || payload.action === "restored") && 
				"changes" in payload &&
				"field_value" in payload.changes &&
				payload.changes?.field_value?.field_type === "iteration" &&
				payload.changes.field_value.field_node_id &&
				payload.installation?.id
			) {
				const octokit = await getOctokitObject(
					GITHUB_AUTHENTICATION_STRATEGY_OPTIONS.APP,
						payload.installation.id,
						ctx.set
				);

				const fieldValue = await octokit.graphql(`
					query($nodeId: ID!) {
						node(id: $nodeId) {
							... on ProjectV2Item {
								fieldValueByName(name: "Sprint") {
									... on ProjectV2ItemFieldIterationValue {
										title
									}
								}
							}
						}
					}
				`, {
					nodeId: payload.projects_v2_item.node_id
				});

				if (DEV_MODE) child.info({ fieldValue }, '[Sprint Field Value]');

				const result = await handleProjectItemChange(octokit, {
					id: payload.projects_v2_item.node_id,
					content: { 
						id: payload.projects_v2_item.content_node_id
					},
					fieldValues: {
						nodes: [{
							field: { 
								name: "Sprint"
							},
							value: fieldValue.node.fieldValueByName?.title || null
						}]
					},
				});
				
				if (DEV_MODE) child.info({ result }, '[Sprint Label Mutation]');
			}
		}

		// TODO: notify the frontend about the changes

		return ctx.body;
	},
	{
			detail: {
				description:
					"Receives a webhook event of the changes that happened in the scopes that this microservice is subscribed to, on your GitHub-App installation.",
				tags: ["github", "webhooks"],
			},
	},
);

/* GENERAL */

/**
 * Used for fetching info from the Github GraphQl API. (quota and other general infos)
 */
export const GITHUB_GENERAL = new Elysia({ prefix: "/info" }).use(
	guardEndpoints(
		new Elysia().group("", (app) =>
			app.use(RESOLVE_JWT).group("/quota", (app) =>
				app
					.get(
						"/",
						async ({ fetchParams, set }) => {
							const response = await fetchRateLimit(fetchParams.auth, set);

							return response;
						},
						{
							detail: {
								description:
									"Get the token quota, that is left for the current hour. 5000 tokens can be used per hour.",
								tags: ["github"],
							},
						},
					)
					.get(
						"/graphql",
						async ({ fetchParams, set }) => {
							const response = await fetchGithubDataUsingGraphql<
								{ rateLimit: RateLimit } | undefined | null
							>(GITHUB_QUOTA, fetchParams.auth, set);

							return response?.data?.rateLimit;
						},
						{
							detail: {
								description:
									"Get the token quota, that is left for the current hour for graphql only. 5000 tokens can be used per hour.",
								tags: ["github"],
							},
						},
					),
			),
		),
	),
);

/* ENDPOINTS */

/**
 * Generates options for an account level endpoint having no children based on the provided description.
 *
 * @param {string} login_type - The type of login, either "organization" or "user". Default is "organization".
 * @param {string|null} description - The description of the options. Default is null.
 * @return {Object} - The generated options object.
 */
const ACCOUNT_LEVEL_OPTIONS = (
	login_type: "organization" | "user" = "organization",
	description: string | null = null,
) => {
	const desc =
		description ??
		`Request anything in the ${login_type} scope.  
        Allowed scopes for the account level: ${GITHUB_ACCOUNT_PARAMS}.`;

	return {
		body: t.Object({
			scopes: t.Array(
				t.Object({
					scopeName: t.Optional(
						t.Enum(GITHUB_ACCOUNT_SCOPES, { default: "essential" }),
					),
					pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
					continueAfter: t.Optional(t.MaybeEmpty(t.String())),
				}),
			),
		}),
		detail: {
			description: desc,
			tags: ["github"],
		},
	};
};

/**
 * Generates options for an account level endpoint having children based on the provided description.
 *
 * @param {string} description - The description of the options.
 * @return {object} - The generated options object.
 */
const ACCOUNT_LEVEL_HAVING_CHILDREN_OPTIONS = (description: string) => {
	return {
		...PROJECT_LEVEL_HAVING_NO_CHILDREN_OPTIONS(),
		detail: {
			description,
			tags: ["github"],
		},
	};
};

/**
 * Generates options for a project level endpoint with no children.
 *
 * @return {Object} The options object with query parameters for the project level.
 */
const PROJECT_LEVEL_HAVING_NO_CHILDREN_OPTIONS = () => {
	return {
		query: t.Object({
			pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
			continueAfter: t.Optional(t.String()),
		}),
	};
};

/**
 * The children endpoints for github accounts (organizations and users).
 */

const FETCH_PROJECTS_FROM_ORGANIZATION = new Elysia({ prefix: "" })
	.use(RESOLVE_JWT)

	/**
	 * Request organization projects.
	 */
	.get(
		"",
		async ({ fetchParams, params: { login_name }, query, set }) => {
			const response = await fetchGithubDataUsingGraphql<{
				projects: ProjectV2;
			}>(
				new OrganizationFetcher(login_name, [
					{
						scopeName: GITHUB_ACCOUNT_SCOPES.PROJECTS,
						pageSize: query.pageSize ?? 1,
						continueAfter: query.continueAfter,
					},
				] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
				fetchParams.auth,
				set,
				fetchParams.auth_type,
			);

			return response;
		},
		ACCOUNT_LEVEL_HAVING_CHILDREN_OPTIONS(
			"Request projects of the organization. (`/projects?pageSize=1&continueAfter=abc`)",
		),
	);

const FETCH_PROJECTS_FROM_USER = new Elysia({ prefix: "" })
	.use(RESOLVE_JWT)

	/**
	 * Request user projects.
	 */
	.get(
		"",
		async ({ fetchParams, params: { login_name }, query, set }) => {
			const response = await fetchGithubDataUsingGraphql<{
				projects: ProjectV2;
			}>(
				new UserFetcher(login_name, [
					{
						scopeName: GITHUB_ACCOUNT_SCOPES.PROJECTS,
						pageSize: query.pageSize ?? 1,
						continueAfter: query.continueAfter,
					},
				] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
				fetchParams.auth,
				set,
				fetchParams.auth_type,
			);

			return response;
		},
		ACCOUNT_LEVEL_HAVING_CHILDREN_OPTIONS(
			"Request projects of the user. (`/projects?pageSize=1&continueAfter=abc`)",
		),
	);

const ACCOUNT_LEVEL_CHILDREN = (login_type: "organization" | "user") =>
	new Elysia({ prefix: "" })
		.use(RESOLVE_JWT)

		/**
		 * Request organization projects.
		 */
		.group("/projects", (app) =>
			app
				.use(
					login_type === "organization"
						? FETCH_PROJECTS_FROM_ORGANIZATION
						: FETCH_PROJECTS_FROM_USER,
				)

				.group("/:project_id_or_name", (app) =>
					app.guard(
						{
							transform({ params }) {
								params.project_id_or_name = maybeStringToNumber(
									params.project_id_or_name,
								);
							},
							params: t.Object({
								login_name: t.String(),
								project_id_or_name: t.Union([t.String(), t.Number()]),
							}),
						},
						(app) =>
							app
								/**
								 * Request anything in the account project. (info and/or repositories)
								 */
								.post(
									"",
									async ({
										fetchParams,
										params: { login_name, project_id_or_name },
										body,
										set,
									}) => {
										const response = await fetchGithubDataUsingGraphql<{
											project: ProjectV2;
										}>(
											AccountScopeEntryRoot(
												login_name,
												getAllRepositoriesInProject(
													project_id_or_name,
													body.project_scopes,
													body.repository_scopes as PageSize<GITHUB_REPOSITORY_SCOPES>[],
												),
												login_type,
											),
											fetchParams.auth,
											set,
											fetchParams.auth_type,
										);

										return response;
									},
									{
										body: t.Object({
											project_scopes: t.Array(
												t.Optional(t.Enum(GITHUB_PROJECT_SCOPES)),
												{ default: ["info"] },
											),
											repository_scopes: t.Array(
												t.Object({
													scopeName: t.Optional(
														t.Enum(GITHUB_REPOSITORY_SCOPES, {
															default: "info",
														}),
													),
													pageSize: t.Optional(
														t.Number({ minimum: 1, maximum: 100 }),
													),
													continueAfter: t.Optional(t.MaybeEmpty(t.String())),
												}),
											),
										}),
										detail: {
											description: `Request anything in the ${login_type} project.  
                            Scopes for the project level: ${GITHUB_PROJECT_PARAMS}.  
                            Scopes for the repository level, that only take effect, if the project scopes include **repositories**: ${GITHUB_REPOSITORY_PARAMS}.`,
											tags: ["github"],
										},
									},
								)

								/**
								 * Request info in the account project.
								 */
								.get(
									"/info",
									async ({
										fetchParams,
										params: { login_name, project_id_or_name },
										set,
									}) => {
										const response = await fetchGithubDataUsingGraphql<{
											project: ProjectV2;
										}>(
											AccountScopeEntryRoot(
												login_name,
												Project(project_id_or_name, [
													GITHUB_PROJECT_SCOPES.INFO,
												]),
												login_type,
											),
											fetchParams.auth,
											set,
											fetchParams.auth_type,
										);

										return response;
									},
									{
										detail: {
											description: `Request anything in the ${login_type} project (info and repositories).  
                            Allowed scopes for the account level: ${GITHUB_ACCOUNT_PARAMS}.`,
											tags: ["github"],
										},
									},
								)

								/**
								 * Request repositories only in the account project. No infos.
								 */
								.group("/repositories", (app) =>
									app
										.post(
											"",
											async ({
												fetchParams,
												params: { login_name, project_id_or_name },
												body,
												set,
											}) => {
												const response = await fetchGithubDataUsingGraphql<{
													project: ProjectV2;
												}>(
													AccountScopeEntryRoot(
														login_name,
														getAllRepositoriesInProject(
															project_id_or_name,
															[GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
															body.scopes as PageSize<GITHUB_REPOSITORY_SCOPES>[],
														),
														login_type,
													),
													fetchParams.auth,
													set,
													fetchParams.auth_type,
												);

												return response;
											},
											{
												body: t.Object({
													scopes: t.Array(
														t.Object({
															scopeName: t.Optional(
																t.Enum(GITHUB_REPOSITORY_SCOPES, {
																	default: "info",
																}),
															),
															pageSize: t.Optional(
																t.Number({ minimum: 1, maximum: 100 }),
															),
															continueAfter: t.Optional(
																t.MaybeEmpty(t.String()),
															),
														}),
													),
												}),
												detail: {
													description: `Request repositories in the ${login_type} project.  
                                Scopes for the repository level: ${GITHUB_REPOSITORY_PARAMS}.`,
													tags: ["github"],
												},
											},
										)

										/**
										 * Root Infos.
										 */
										.guard(
											{
												...PROJECT_LEVEL_HAVING_NO_CHILDREN_OPTIONS(),
											},
											(app) =>
												app
													.get(
														"/count",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "count",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository count in the ${login_type} project. (pageSize and continueAfter are for the repositories, because this endpoint doesn't have child nodes)`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/essential",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "essential",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository essential info in the ${login_type} project. (pageSize and continueAfter are for the repositories, because this endpoint doesn't have child nodes)`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/info",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "info",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository info in the ${login_type} project. (pageSize and continueAfter are for the repositories, because this endpoint doesn't have child nodes)`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/license",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "license",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository license in the ${login_type} project. (pageSize and continueAfter are for the repositories, because this endpoint doesn't have child nodes)`,
																tags: ["github"],
															},
														},
													),
										)

										/**
										 * Children Nodes.
										 */
										.guard(
											{
												query: t.Object({
													rootPageSize: t.Optional(
														t.Numeric({ minimum: 1, maximum: 100 }),
													),
													rootContinueAfter: t.Optional(
														t.MaybeEmpty(t.String()),
													),
													pageSize: t.Optional(
														t.Numeric({ minimum: 1, maximum: 100 }),
													),
													continueAfter: t.Optional(t.MaybeEmpty(t.String())),
												}),
											},
											(app) =>
												app
													.get(
														"/vulnerabilities",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "vulnerabilities",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																				{
																					scopeName: "count",
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter:
																						query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository vulnerabilities in the ${login_type} project.`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/topics",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "topics",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																				{
																					scopeName: "count",
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter:
																						query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository topics in the ${login_type} project.`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/labels",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "labels",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																				{
																					scopeName: "count",
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter:
																						query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository labels in the ${login_type} project.`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/releases",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "releases",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																				{
																					scopeName: "count",
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter:
																						query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository releases in the ${login_type} project.`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/deployments",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "deployments",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																				{
																					scopeName: "count",
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter:
																						query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository deployments in the ${login_type} project.`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/languages",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "languages",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																				{
																					scopeName: "count",
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter:
																						query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository languages in the ${login_type} project.`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/issues",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "issues",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																				{
																					scopeName: "count",
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter: query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																			null,
																			undefined,
																			null,
																			query.labels?.split(','),
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															query: t.Object({
																rootPageSize: t.Optional(
																	t.Numeric({ minimum: 1, maximum: 100 }),
																),
																rootContinueAfter: t.Optional(
																	t.MaybeEmpty(t.String()),
																),
																pageSize: t.Optional(
																	t.Numeric({ minimum: 1, maximum: 100 }),
																),
																continueAfter: t.Optional(t.MaybeEmpty(t.String())),
																labels: t.Optional(t.String()),
															}),
															detail: {
																description: `Request repository issues in the ${login_type} project. Filter by labels with: labels=sprint-01,bug,feature`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/collaborators",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: "collaborators",
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter,
																				},
																				{
																					scopeName: "count",
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter:
																						query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository collaborators in the ${login_type} project. (Your token has to have push permission in the repositories.)`,
																tags: ["github"],
															},
														},
													)
													.get(
														"/contributions",
														async ({
															fetchParams,
															params: { login_name, project_id_or_name },
															query,
															set,
														}) => {
															const response =
																await fetchGithubDataUsingGraphql<{
																	project: ProjectV2;
																}>(
																	AccountScopeEntryRoot(
																		login_name,
																		getAllRepositoriesInProject(
																			project_id_or_name,
																			[
																				GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																			],
																			[
																				{
																					scopeName: GITHUB_REPOSITORY_SCOPES.CONTRIBUTIONS,
																					pageSize: query.pageSize ?? 1,
																					continueAfter: query.continueAfter?.replaceAll("+", " "), // TODO: make this global (not sure, if only commits can have spaces in page hashes)
																				},
																				{
																					scopeName: GITHUB_REPOSITORY_SCOPES.COUNT,
																					pageSize: query.rootPageSize ?? 1,
																					continueAfter: query.rootContinueAfter,
																				},
																			] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		),
																		login_type,
																	),
																	fetchParams.auth,
																	set,
																	fetchParams.auth_type,
																);

															return response;
														},
														{
															detail: {
																description: `Request repository contributions in the ${login_type} project.`,
																tags: ["github"],
															}
														}
													)
										)

										/**
										 * Milestones.
										 */
										.group("/milestones", (app) =>
											app
												/**
												 * Milestones.
												 */
												.get(
													"",
													async ({
														fetchParams,
														params: { login_name, project_id_or_name },
														query,
														set,
													}) => {
														const response = await fetchGithubDataUsingGraphql<{
															project: ProjectV2;
														}>(
															AccountScopeEntryRoot(
																login_name,
																getAllRepositoriesInProject(
																	project_id_or_name,
																	[GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
																	[
																		{
																			scopeName: "milestones",
																			pageSize: query.pageSize ?? 1,
																			continueAfter: query.continueAfter,
																		},
																		{
																			scopeName: "count",
																			pageSize: query.rootPageSize ?? 1,
																			continueAfter: query.rootContinueAfter,
																		},
																	] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																),
																login_type,
															),
															fetchParams.auth,
															set,
															fetchParams.auth_type,
														);

														return response;
													},
													{
														query: t.Object({
															rootPageSize: t.Optional(
																t.Numeric({ minimum: 1, maximum: 100 }),
															),
															rootContinueAfter: t.Optional(
																t.MaybeEmpty(t.String()),
															),
															pageSize: t.Optional(
																t.Numeric({ minimum: 1, maximum: 100 }),
															),
															continueAfter: t.Optional(
																t.MaybeEmpty(t.String()),
															),
														}),
														detail: {
															description: `Request repository milestones in the ${login_type} project.`,
															tags: ["github"],
														},
													},
												)

												/**
												 * Milestones Issues.
												 */
												.get(
													"/issues",
													async ({
														fetchParams,
														params: { login_name, project_id_or_name },
														query,
														set,
													}) => {
														const issues_states =
															parseScopes<GITHUB_MILESTONE_ISSUE_STATES>(
																query.issues_states,
																GITHUB_MILESTONE_ISSUE_STATES,
																set,
															);

														const response =
															await fetchGithubDataUsingGraphql<{
																project: ProjectV2;
															}>(
																AccountScopeEntryRoot(
																	login_name,
																	getAllRepositoriesInProject(
																		project_id_or_name,
																		[GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
																		[
																			{
																				scopeName: "milestones",
																				pageSize: query.milestonesPageSize ?? 1,
																				continueAfter:
																					query.milestonesContinueAfter,
																			},
																			{
																				scopeName: "issues",
																				pageSize: query.issuesPageSize ?? 1,
																				continueAfter: query.issuesContinueAfter,
																			},
																			{
																				scopeName: "count",
																				pageSize: query.rootPageSize ?? 1,
																				continueAfter: query.rootContinueAfter,
																			},
																		] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																		issues_states,
																		undefined,
																		null,
																		query.labels?.split(','),
																	),
																	login_type,
																),
																fetchParams.auth,
																set,
																fetchParams.auth_type,
															);

														return response;
													},
													{
														query: t.Object({
															rootPageSize: t.Optional(
																t.Numeric({ minimum: 1, maximum: 100 }),
															),
															rootContinueAfter: t.Optional(
																t.MaybeEmpty(t.String()),
															),
															milestonesPageSize: t.Optional(
																t.Numeric({ minimum: 1, maximum: 100 }),
															),
															milestonesContinueAfter: t.Optional(
																t.MaybeEmpty(t.String()),
															),
															issuesPageSize: t.Optional(
																t.Numeric({ minimum: 1, maximum: 100 }),
															),
															issuesContinueAfter: t.Optional(
																t.MaybeEmpty(t.String()),
															),
															issues_states: t.Optional(t.String()), // enum arrays can not be passed directly in query params, that is why this parameter is validated in the callback
															labels: t.Optional(t.String()),
														}),
														detail: {
															description: `Request repository milestones issues in the ${login_type} project. Filter by labels with: labels=sprint-01,bug,feature`,
															tags: ["github"],
														},
													},
												)

												/**
												 * Milestone and Issues.
												 */
												.group("/:milestone_id", (app) =>
													app.guard(
														{
															params: t.Object({
																login_name: t.String(),
																project_id_or_name: t.Union([
																	t.String(),
																	t.Number(),
																]),
																milestone_id: t.Numeric(),
															}),
														},
														(app) =>
															app
																.get(
																	"",
																	async ({
																		fetchParams,
																		params: {
																			login_name,
																			project_id_or_name,
																			milestone_id,
																		},
																		query,
																		set,
																	}) => {
																		const response =
																			await fetchGithubDataUsingGraphql<{
																				project: ProjectV2;
																			}>(
																				AccountScopeEntryRoot(
																					login_name,
																					getAllRepositoriesInProject(
																						project_id_or_name,
																						[
																							GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																						],
																						[
																							{
																								scopeName: "milestones", // fetches a single milestone, because amount is set to singular
																								pageSize: 1,
																								continueAfter: null,
																							},
																							{
																								scopeName: "count",
																								pageSize: query.pageSize ?? 1,
																								continueAfter:
																									query.continueAfter,
																							},
																						] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																						null,
																						GRAMMATICAL_NUMBER.SINGULAR,
																						milestone_id,
																					),
																					login_type,
																				),
																				fetchParams.auth,
																				set,
																				fetchParams.auth_type,
																			);

																		return response;
																	},
																	{
																		...PROJECT_LEVEL_HAVING_NO_CHILDREN_OPTIONS(),
																		detail: {
																			description: `Request repository milestone in the ${login_type} project.`,
																			tags: ["github"],
																		},
																	},
																)
																.get(
																	"/issues",
																	async ({
																		fetchParams,
																		params: {
																			login_name,
																			project_id_or_name,
																			milestone_id,
																		},
																		query,
																		set,
																	}) => {
																		const issues_states =
																			parseScopes<GITHUB_MILESTONE_ISSUE_STATES>(
																				query.issues_states,
																				GITHUB_MILESTONE_ISSUE_STATES,
																				set,
																			);

																		const response =
																			await fetchGithubDataUsingGraphql<{
																				project: ProjectV2;
																			}>(
																				AccountScopeEntryRoot(
																					login_name,
																					getAllRepositoriesInProject(
																						project_id_or_name,
																						[
																							GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED,
																						],
																						[
																							{
																								scopeName: "milestones",
																								pageSize:
																									query.milestonesPageSize ?? 1,
																								continueAfter:
																									query.milestonesContinueAfter,
																							},
																							{
																								scopeName: "issues",
																								pageSize:
																									query.issuesPageSize ?? 1,
																								continueAfter:
																									query.issuesContinueAfter,
																							},
																							{
																								scopeName: "count",
																								pageSize:
																									query.rootPageSize ?? 1,
																								continueAfter:
																									query.rootContinueAfter,
																							},
																						] as PageSize<GITHUB_REPOSITORY_SCOPES>[],
																						issues_states,
																						GRAMMATICAL_NUMBER.SINGULAR,
																						milestone_id,
																						query.labels?.split(','),
																					),
																					login_type,
																				),
																				fetchParams.auth,
																				set,
																				fetchParams.auth_type,
																			);

																		return response;
																	},
																	{
																		query: t.Object({
																			rootPageSize: t.Optional(
																				t.Numeric({ minimum: 1, maximum: 100 }),
																			),
																			rootContinueAfter: t.Optional(
																				t.MaybeEmpty(t.String()),
																			),
																			milestonesPageSize: t.Optional(
																				t.Numeric({ minimum: 1, maximum: 100 }),
																			),
																			milestonesContinueAfter: t.Optional(
																				t.MaybeEmpty(t.String()),
																			),
																			issuesPageSize: t.Optional(
																				t.Numeric({ minimum: 1, maximum: 100 }),
																			),
																			issuesContinueAfter: t.Optional(
																				t.MaybeEmpty(t.String()),
																			),
																			issues_states: t.Optional(t.String()), // enum arrays can not be passed directly in query params, that is why this parameter is validated in the callback
																			labels: t.Optional(t.String()),
																		}),
																		detail: {
																			description: `Request repository milestone issues in the ${login_type} project. 
																			(issues_states=open,closed || issues_states=open || issues_states=closed)
																			Filter by labels with: labels=sprint-01,bug,feature`,
																			tags: ["github"],
																		},
																	},
																),
														),
												),
										),
								),
					),
				),
		)

		/**
		 * Request a repository in the account.
		 */
		.post(
			"repository/:repository_name",
			async ({
				fetchParams,
				params: { login_name, repository_name },
				body,
				set,
			}) => {
				const response = await fetchGithubDataUsingGraphql<{
					project: ProjectV2;
				}>(
					AccountScopeEntryRoot(
						login_name,
						new Repository({
							name: repository_name,
							scopes: body.scopes as PageSize<GITHUB_REPOSITORY_SCOPES>[],
						}).getQuery(),
						login_type,
					),
					fetchParams.auth,
					set,
					fetchParams.auth_type,
				);

				return response;
			},
			{
				params: t.Object({
					login_name: t.String(),
					repository_name: t.String(),
				}),
				body: t.Object({
					scopes: t.Array(
						t.Object({
							scopeName: t.Optional(
								t.Enum(GITHUB_REPOSITORY_SCOPES, { default: "info" }),
							),
							pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
							continueAfter: t.Optional(t.MaybeEmpty(t.String())),
						}),
					),
				}),
				detail: {
					description: `Request a repository in the ${login_type} project.  
            Scopes for the repository level: ${GITHUB_REPOSITORY_PARAMS}.`,
					tags: ["github"],
				},
			},
		);

/**
 * The endpoints for github organizations.
 */
export const GITHUB_ORGS = new Elysia({ prefix: "/orgs" }).use(
	guardEndpoints(
		new Elysia().group("", (app) =>
			app.use(RESOLVE_JWT).group("/:login_name", (app) =>
				app
					/**
					 * Request anything in the organization.
					 */
					.post(
						"",
						async ({ fetchParams, params: { login_name }, body, set }) => {
							const response = await fetchGithubDataUsingGraphql<{
								organization: Organization;
							}>(
								new OrganizationFetcher(
									login_name,
									body.scopes as PageSize<GITHUB_ACCOUNT_SCOPES>[],
								).getQuery(),
								fetchParams.auth,
								set,
								fetchParams.auth_type,
							);

							return response;
						},
						ACCOUNT_LEVEL_OPTIONS("organization"),
					)

					/**
					 * Request essential organization info.
					 */
					.get(
						"/essential",
						async ({ fetchParams, params: { login_name }, set }) => {
							const response = await fetchGithubDataUsingGraphql<{
								organization: Organization;
							}>(
								new OrganizationFetcher(login_name, [
									{
										scopeName: GITHUB_ACCOUNT_SCOPES.ESSENTIAL,
										pageSize: 1,
										continueAfter: null,
									},
								] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
								fetchParams.auth,
								set,
								fetchParams.auth_type,
							);

							return response;
						},
						{
							detail: {
								description: "Request essential infos of the organization.",
								tags: ["github"],
							},
						},
					)

					/**
					 * Request organization info.
					 */
					.get(
						"/info",
						async ({ fetchParams, params: { login_name }, set }) => {
							const response = await fetchGithubDataUsingGraphql<{
								organization: Organization;
							}>(
								new OrganizationFetcher(login_name, [
									{
										scopeName: GITHUB_ACCOUNT_SCOPES.INFO,
										pageSize: 1,
										continueAfter: null,
									},
								] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
								fetchParams.auth,
								set,
								fetchParams.auth_type,
							);

							return response;
						},
						{
							detail: {
								description: "Request infos of the organization.",
								tags: ["github"],
							},
						},
					)

					/**
					 * Request organization packages.
					 */
					.get(
						"/packages",
						async ({ fetchParams, params: { login_name }, query, set }) => {
							const response = await fetchGithubDataUsingGraphql<{
								organization: Organization;
							}>(
								new OrganizationFetcher(login_name, [
									{
										scopeName: GITHUB_ACCOUNT_SCOPES.PACKAGES,
										pageSize: query.pageSize ?? 1,
										continueAfter: query.continueAfter,
									},
								] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
								fetchParams.auth,
								set,
								fetchParams.auth_type,
							);

							return response;
						},
						ACCOUNT_LEVEL_HAVING_CHILDREN_OPTIONS(
							"Request packages of the organization. (`/packages?pageSize=1&continueAfter=abc`)",
						),
					)

					// --------------------------------------------------------------------------------------------------------------------------
					/*                                                 Organization children.                                                  */
					// --------------------------------------------------------------------------------------------------------------------------

					.use(ACCOUNT_LEVEL_CHILDREN("organization")),
			),
		),
	),
);

/**
 * The endpoints for github users.
 */
export const GITHUB_USERS = new Elysia({ prefix: "/users" }).use(
	guardEndpoints(
		new Elysia().group("", (app) =>
			app.use(RESOLVE_JWT).group("/:login_name", (app) =>
				app
					/**
					 * Request anything in the user.
					 */
					.post(
						"",
						async ({ fetchParams, params: { login_name }, body, set }) => {
							const response = await fetchGithubDataUsingGraphql<{
								user: User;
							}>(
								new UserFetcher(
									login_name,
									body.scopes as PageSize<GITHUB_ACCOUNT_SCOPES>[],
								).getQuery(),
								fetchParams.auth,
								set,
								fetchParams.auth_type,
							);

							return response;
						},
						ACCOUNT_LEVEL_OPTIONS("user"),
					)

					/**
					 * Request essential user info.
					 */
					.get(
						"/essential",
						async ({ fetchParams, params: { login_name }, set }) => {
							const response = await fetchGithubDataUsingGraphql<{
								user: User;
							}>(
								new UserFetcher(login_name, [
									{
										scopeName: GITHUB_ACCOUNT_SCOPES.ESSENTIAL,
										pageSize: 1,
										continueAfter: null,
									},
								] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
								fetchParams.auth,
								set,
								fetchParams.auth_type,
							);

							return response;
						},
						{
							detail: {
								description: "Request essential infos of the user.",
								tags: ["github"],
							},
						},
					)

					/**
					 * Request user info.
					 */
					.get(
						"/info",
						async ({ fetchParams, params: { login_name }, set }) => {
							const response = await fetchGithubDataUsingGraphql<{
								user: User;
							}>(
								new UserFetcher(login_name, [
									{
										scopeName: GITHUB_ACCOUNT_SCOPES.INFO,
										pageSize: 1,
										continueAfter: null,
									},
								] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
								fetchParams.auth,
								set,
								fetchParams.auth_type,
							);

							return response;
						},
						{
							detail: {
								description: "Request infos of the user.",
								tags: ["github"],
							},
						},
					)

					/**
					 * Request user packages.
					 */
					.get(
						"/packages",
						async ({ fetchParams, params: { login_name }, query, set }) => {
							const response = await fetchGithubDataUsingGraphql<{
								user: User;
							}>(
								new UserFetcher(login_name, [
									{
										scopeName: GITHUB_ACCOUNT_SCOPES.PACKAGES,
										pageSize: query.pageSize ?? 1,
										continueAfter: query.continueAfter,
									},
								] as PageSize<GITHUB_ACCOUNT_SCOPES>[]).getQuery(),
								fetchParams.auth,
								set,
								fetchParams.auth_type,
							);

							return response;
						},
						ACCOUNT_LEVEL_HAVING_CHILDREN_OPTIONS(
							"Request packages of the user. (`/packages?pageSize=1&continueAfter=abc`)",
						),
					)

					// --------------------------------------------------------------------------------------------------------------------------
					/*                                                     User children.                                                      */
					// --------------------------------------------------------------------------------------------------------------------------

					.use(ACCOUNT_LEVEL_CHILDREN("user")),
			),
		),
	),
);
