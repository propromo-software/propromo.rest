import { Repository } from "./scopes";
import { GITHUB_REPOSITORY_SCOPES, GITHUB_PROJECT_SCOPES, PageSize, GRAMMATICAL_NUMBER } from "./types";

export const GITHUB_QUOTA = `{
    rateLimit {
        limit
        remaining
        used
        resetAt
    }
}`;

/**
 * Helper function that returns the Github GraphQl query part needed for the fetching of a **project** using the parent query as root. (multiple can be fetched at the organization level)
 */
export const Project = (project_name: string | number, project_scopes: GITHUB_PROJECT_SCOPES[], repository_query: string | null = null) => {
    const name_is_text = typeof project_name === "string";
    const head = name_is_text ?
        `projectsV2(query: "${project_name}", first: 1) { 
            nodes {` :
        `projectV2(number: ${project_name}) {`; // fetch by name or id
    const tail = name_is_text ? "}" : "";

    // TODO: implement pagination

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
        
        ${project_scopes.includes(GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED) && repository_query ? repository_query : ""}

        ${tail}
    }`

    console.log(query)

    return query;
}

// TODO: issues states
// milestones amount
// count option as query parameter

export const getAllRepositoriesInProject = (
    project_name: string | number,
    project_scopes: GITHUB_PROJECT_SCOPES[],
    repository_scopes: PageSize<GITHUB_REPOSITORY_SCOPES>[]
) => {
    const repository = new Repository({
        scopes: repository_scopes
    });

    return Project(
        project_name,
        project_scopes,
        repository.getQuery(null, GRAMMATICAL_NUMBER.PLURAL, null, true, true)
    );
}

/**
 * Parameter query_children can be `getRepositoryByName(...)` or `getAllRepositoriesInProject(...)` for example. Basically any scope that is under `user` and `organization`.
 */
export const AccountScopeEntryRoot = (login_name: string, query_children: string, login_type: "user" | "organization" = "organization") => {
    const query = `{
        ${login_type}(login: "${login_name}") {
            ${query_children}
        }
    }`

    console.log(query);

    return query;
}
