import { Repository } from "./scopes";
import {
	type GITHUB_REPOSITORY_SCOPES,
	GITHUB_PROJECT_SCOPES,
	type PageSize,
	GRAMMATICAL_NUMBER,
	type GITHUB_MILESTONE_ISSUE_STATES,
} from "./types";
import { DEV_MODE } from "../../../environment";

export const GITHUB_QUOTA = `{
    rateLimit {
        limit
        remaining
        used
        resetAt
    }
}`;

/**
 * Helper function that returns the Github GraphQl query part needed for the fetching of a **project** using the parent query as root.
 * Multiple can be fetched at the organization level
 */
export const Project = (
	project_name: string | number,
	project_scopes: GITHUB_PROJECT_SCOPES[],
	repository_query: string | null = null,
) => {
	const name_is_text = typeof project_name === "string";
	const head = name_is_text
		? `projectsV2(query: "${project_name}", first: 1, after: ${null}) { 
            nodes {`
		: `projectV2(number: ${project_name}) {`; // fetch by name or id // TODO: implement pagination for when fetched with name and not id (a lot of work needed here)
	const tail = name_is_text ? "}" : "";

	const query = `
    ${head}
        title

        ${project_scopes.includes(GITHUB_PROJECT_SCOPES.INFO) ? `
        shortDescription
        url
        public
        createdAt
        updatedAt
        closedAt
        readme
        ` : ""}
        
        ${project_scopes.includes(GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED) &&
			repository_query
			? repository_query
			: ""
		}

        ${tail}
    }`;

	if (DEV_MODE) console.log("Project(...)");
	console.log(query);

	return query;
};

/**
 * Retrieves all repositories in a project, if passed as `query_children` to `AccountScopeEntryRoot(...)`.
 *
 * @param {string | number} project_name - The name or ID of the project.
 * @param {GITHUB_PROJECT_SCOPES[]} project_scopes - The scopes of the project.
 * @param {PageSize<GITHUB_REPOSITORY_SCOPES>[]} repository_scopes - The scopes of the repositories.
 * @param {GITHUB_MILESTONE_ISSUE_STATES[] | null} issues_states - The states of the milestone issues.
 * @param {GRAMMATICAL_NUMBER} [milestones_amount=GRAMMATICAL_NUMBER.PLURAL] - The amount of milestones.
 * @param {number | null} [milestone_number=null] - The number of the milestone.
 * @param {string[]} [labels] - The labels of the issues.
 * @return {unknown} The result of the function.
 */
export const getAllRepositoriesInProject = (
	project_name: string | number,
	project_scopes: GITHUB_PROJECT_SCOPES[],
	repository_scopes: PageSize<GITHUB_REPOSITORY_SCOPES>[],
	issues_states: GITHUB_MILESTONE_ISSUE_STATES[] | null = null,
	milestones_amount: GRAMMATICAL_NUMBER = GRAMMATICAL_NUMBER.PLURAL,
	milestone_number: number | null = null,
	labels?: string[],
) => {
	const repository = new Repository({
		scopes: repository_scopes,
	});

	return Project(
		project_name,
		project_scopes,
		repository.getQuery(issues_states, milestones_amount, milestone_number, labels),
	);
};

/**
 * Generates a GraphQL query for the root of an account scope entry.
 * Parameter `query_children` can be `getRepositoryByName(...)` or `getAllRepositoriesInProject(...)` for example. Basically any scope that is under `user` and `organization`.
 *
 *
 * @param {string} login_name - The login name of the user or organization.
 * @param {string} query_children - The query for the children of the account scope entry.
 * @param {"user" | "organization"} login_type - The type of the login (default is "organization").
 * @return {string} The generated GraphQL query.
 */
export const AccountScopeEntryRoot = (
	login_name: string,
	query_children: string,
	login_type: "user" | "organization",
) => {
	const query = `{
        ${login_type}(login: "${login_name}") {
            ${query_children}
        }
    }`;

	if (DEV_MODE) console.log("AccountScopeEntryRoot(...)");
	console.log(query);

	return query;
};
