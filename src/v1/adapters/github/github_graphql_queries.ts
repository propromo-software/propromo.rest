import { issues, license, topics, labels, vulnerabilities, releases, deployments } from "./github_repository_scopes";
import { GITHUB_MILESTONES_DEPTH, GITHUB_MILESTONE_ISSUE_STATES, GITHUB_PROJECT_INPUT_SCOPES, GITHUB_PROJECT_SCOPES, GITHUB_REPOSITORY_SCOPES, GRAMMATICAL_NUMBER } from "./github_types";

/* Query building helper functions: */

/**
* Helper function that returns the Github GraphQl query part needed for the fetching of a **repository** or multiple **repositories** using the parent query as root.
*/
const GITHUB_REPOSITORY = function (amount: GRAMMATICAL_NUMBER, owner?: string, name?: string) {
    let repositoryQueryStart = `
        repositories(first: 10) {
            totalCount
            nodes {
        `;
    let repositoryQueryEnd = `}`;
    if (amount === GRAMMATICAL_NUMBER.SINGULAR && owner && name) {
        repositoryQueryStart = `repository(owner: "${owner}", name: "${name}") {`; 
        repositoryQueryEnd = ``;
    }

    return `
    ${repositoryQueryStart}
            name
            description
            updatedAt
            createdAt
            isArchived
            isPrivate
            isTemplate
            
            resourcePath
            homepageUrl
            sshUrl
            projectsUrl
            
            ${license}
            ${vulnerabilities}
            ${topics}
            ${releases}
            ${labels}
            ${deployments}
            milestones(first: 10) {
                nodes {
                    createdAt
                    closedAt
                    description
                    dueOn
                    progressPercentage
                    title
                    updatedAt
                    url
                    state

                    open_issues: issues(first: 50, states: [OPEN]) {
                        totalCount
                        ${issues}
                    }
                    closed_issues: issues(first: 50, states: [CLOSED]) {
                        totalCount
                        ${issues}
                    }
                }
            }
            mentionableUsers(first: 10) {
                nodes {
                    avatarUrl
                    email
                    login
                    name
                    pronouns
                    url
                    websiteUrl
                }
            }
            primaryLanguage {
                color
                name
            }
            languages(first: 10) {
                totalCount
                nodes {
                    color
                    name
                }
            }
            collaborators(first: 10) {
                nodes {
                    avatarUrl
                    email
                    login
                    name
                    pronouns
                    url
                    websiteUrl
                }
            }
        ${repositoryQueryEnd}
    }`;
}

/**
* Helper function that returns the Github GraphQl query part needed for the fetching of multiple **repositories** associated with a project using the parent query as root (scoped).
*/
const GITHUB_PROJECT_REPOSITORIES_SCOPED = function (scopes: GITHUB_REPOSITORY_SCOPES[] | null) {
    // not included: collaborators, mentionableUsers, primaryLanguage, languages

    const milestones = `
    milestones(first: 10) {
        nodes {
            createdAt
            closedAt
            description
            dueOn
            progressPercentage
            title
            updatedAt
            url
            state

            ${scopes && scopes.includes(GITHUB_REPOSITORY_SCOPES.ISSUES) ? `
            open_issues: issues(first: 50, states: [OPEN]) {
                totalCount
                ${issues}
            }
            closed_issues: issues(first: 50, states: [CLOSED]) {
                totalCount
                ${issues}
            }
            ` : ""}
        }
    }
    `;

    if (scopes === null) {
        return "";
    } else if (scopes.length === 1 && scopes.includes(GITHUB_REPOSITORY_SCOPES.COUNT)) {
        return `
        repositories(first: 10) {
            totalCount
        }
        `;
    } else if (scopes.includes(GITHUB_REPOSITORY_SCOPES.ALL)) {
        return GITHUB_REPOSITORY(GRAMMATICAL_NUMBER.PLURAL);
    } else {
        return `
        repositories(first: 10) {
            ${scopes.includes(GITHUB_REPOSITORY_SCOPES.COUNT) ? "totalCount" : ""}
            nodes {
                ${scopes.includes(GITHUB_REPOSITORY_SCOPES.INFO) ? `
                name
                description
                updatedAt
                createdAt
                isArchived
                isPrivate
                isTemplate
                
                resourcePath
                homepageUrl
                sshUrl
                projectsUrl
                ` : ""}

                ${scopes.includes(GITHUB_REPOSITORY_SCOPES.LICENSE) ? license : ""}
                ${scopes.includes(GITHUB_REPOSITORY_SCOPES.TOPICS) ? topics : ""}
                ${scopes.includes(GITHUB_REPOSITORY_SCOPES.LABELS) ? labels : ""}
                ${scopes.includes(GITHUB_REPOSITORY_SCOPES.VULNERABILITIES) ? vulnerabilities : ""}
                ${scopes.includes(GITHUB_REPOSITORY_SCOPES.RELEASES) ? releases : ""}
                ${scopes.includes(GITHUB_REPOSITORY_SCOPES.DEPLOYMENTS) ? deployments : ""}
                ${scopes.includes(GITHUB_REPOSITORY_SCOPES.MILESTONES) ? milestones : ""}
            }
        }
        `;
    }
}

/**
 * Helper function that returns the Github GraphQl query part needed for the fetching of a **project** or multiple **projects** using the parent query as root.
 */
const GITHUB_PROJECT = function (amount: GRAMMATICAL_NUMBER, name?: string | number, view?: number) {
    let projectQueryParameters = amount === GRAMMATICAL_NUMBER.SINGULAR ? `query: "${name}", first: 1` : `first: 100`;
    let projectV2 = `projectsV2(${projectQueryParameters})`;
    let repositoryQueryStart = `
    ${projectV2} {
        totalCount
        nodes {
    `;
    let repositoryQueryEnd = `}`;

    if (amount === GRAMMATICAL_NUMBER.DEFAULT) {
        projectQueryParameters = `number: ${name}`;
        projectV2 = `projectV2(${projectQueryParameters})`;
        repositoryQueryStart = `
        ${projectV2} {
        `;
        repositoryQueryEnd = ``;
    }

    let viewQuery = `
    view(number: ${view}) {
        createdAt
        updatedAt
        name
        filter
        layout
    }`;

    if (view === -1) {
        view = 10;
        
        viewQuery = `
        views(first: ${view}) {
            totalCount
            nodes {
                createdAt
                updatedAt
                name
                filter
                layout
            }
        }`;
    }

    return `
    ${repositoryQueryStart}
            title
            shortDescription
            url
            public
            createdAt
            updatedAt
            closedAt
            readme
            
            ${viewQuery}

            items(first: 100) {
                totalCount
                nodes {
                    createdAt
                      updatedAt
                      isArchived
                      type
                }
            }

            teams(first: 4) {
                totalCount
                nodes {
                    avatarUrl
                    combinedSlug
                    createdAt
                    updatedAt
                    description
                    membersUrl
                    name
                    slug
                    members(first: 32) {
                        nodes {
                        avatarUrl
                        email
                        login
                        name
                        pronouns
                        url
                        websiteUrl
                        }
                    }
                }
            }
            
            ${GITHUB_REPOSITORY(GRAMMATICAL_NUMBER.PLURAL)}
        ${repositoryQueryEnd}
    }`;
}

/**
 * Helper function that returns the Github GraphQl query part needed for the fetching of a **project** using the parent query as root (scoped).
 */
const GITHUB_PROJECT_SCOPED = function (project_id: number, scopes: GITHUB_PROJECT_INPUT_SCOPES) {
    let info = "";
    let repositories = "";

    const FETCH_ALL_REPOSITORY_SCOPES = Array.isArray(scopes);
    const project_scopes = FETCH_ALL_REPOSITORY_SCOPES ? scopes : scopes.project_scopes;
    const repository_scopes: GITHUB_REPOSITORY_SCOPES[] | null = FETCH_ALL_REPOSITORY_SCOPES ? null : scopes.repository_scopes;

    if (project_scopes.includes(GITHUB_PROJECT_SCOPES.INFO)) {
        info = `
            title
            shortDescription
            url
            public
            createdAt
            updatedAt
            closedAt
            readme
        `;
    }

    if (project_scopes.includes(GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED) && repository_scopes) {
        repositories = `
        ${GITHUB_PROJECT_REPOSITORIES_SCOPED(repository_scopes)}
        `;
    }

    return `
    projectV2(number: ${project_id}) {
        ${info}
        ${repositories}
    }`;
}

/* Entry functions: */

/* ORGANIZATIONS and USERS */

/**
 * Entry function for the fetching of a **organization project** from the Github GraphQl API.
 * Schema: ``/orgs/<LOGIN_NAME>/projects/<PROJECT_NUMBER>[/views/<VIEW_NUMBER>]``
 */
export const GITHUB_DEFAULT_PROJECT = function (login_name: string, project_id: number, project_view: number, login_type: string = "organization") {
    // every projects items are stored in the repositories it is connected to
    return `{
        ${login_type}(login: "${login_name}") {
            ${GITHUB_PROJECT(GRAMMATICAL_NUMBER.DEFAULT, project_id, project_view)}
        }
    }`
}

/**
 * Entry function for the fetching of a **organization projects root info** from the Github GraphQl API.
 * Schema: ``/users/<LOGIN_NAME>/projects/<PROJECT_NUMBER>/infos``
 */
export const GITHUB_PROJECT_INFO = function (login_name: string, project_id: number, login_type: string = "organization") {
    // every projects items are stored in the repositories it is connected to
    return `{
        ${login_type}(login: "${login_name}") {
            ${GITHUB_PROJECT_SCOPED(project_id, [GITHUB_PROJECT_SCOPES.INFO])}
        }
    }`
}

/**
 * Entry function for the fetching of a **organization projects repositories** from the Github GraphQl API.
 * Schema: ``/users/<LOGIN_NAME>/projects/<PROJECT_NUMBER>/repositories``
 */
export const GITHUB_PROJECT_REPOSITORIES = function (login_name: string, project_id: number, login_type: string = "organization") {
    // every projects items are stored in the repositories it is connected to
    return `{
        ${login_type}(login: "${login_name}") {
            ${GITHUB_PROJECT_SCOPED(project_id, {
                project_scopes: [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                repository_scopes: [GITHUB_REPOSITORY_SCOPES.ALL]
            })}
        }
    }`
}

/**
 * Entry function for the fetching of a **organization projects repositories** from the Github GraphQl API (scoped).
 * Schema: ``/users/<LOGIN_NAME>/projects/<PROJECT_NUMBER>/repositories?scopes=<REPOSITORY_SCOPES>``
 */
export const GITHUB_PROJECT_REPOSITORIES_AND_QUERY = function (login_name: string, project_id: number, repository_scopes: GITHUB_REPOSITORY_SCOPES[] | null, login_type: string = "organization") {
    // every projects items are stored in the repositories it is connected to
    return `{
        ${login_type}(login: "${login_name}") {
            ${GITHUB_PROJECT_SCOPED(project_id, {
                project_scopes: [GITHUB_PROJECT_SCOPES.REPOSITORIES_LINKED],
                repository_scopes: repository_scopes
            })}
        }
    }`
}

/**
 * Entry function for the fetching of **milestones/issues** from the Github GraphQl API (scoped).
 * Schema: ``/users/<LOGIN_NAME>/projects/<PROJECT_NUMBER>/repositories/milestones?depth=<MILESTONE_DEPTH>&issue_states=<ISSUE_STATES>``
 */
export const GITHUB_PROJECT_REPOSITORY_MILESTONES_AND_QUERY = function (
    login_name: string, project_id: number, milestone_id: number, 
    depth: GITHUB_MILESTONES_DEPTH[], issue_states: GITHUB_MILESTONE_ISSUE_STATES[] | null = null,
    login_type: string = "organization") {
    // every projects items are stored in the repositories it is connected to

    const return_node_root_infos = depth.includes(GITHUB_MILESTONES_DEPTH.INFO);
    const return_node_issues = depth.includes(GITHUB_MILESTONES_DEPTH.ISSUES);
    const issue_states_string_uppercase = issue_states ? issue_states.map((state) => state.toUpperCase()).join('", "') : null;
    
    return `{
        ${login_type}(login: "${login_name}") {
            projectV2(number: ${project_id}) {
                repositories(first: 10) {
                    ${return_node_root_infos ? "totalCount" : ""}
                    nodes {
                        milestone(number: ${milestone_id}) {
                            ${return_node_root_infos ? `
                            createdAt
                            closedAt
                            description
                            dueOn
                            progressPercentage
                            title
                            updatedAt
                            url
                            state
                            ` : ""}

                            ${return_node_issues ? `
                            filtered_issues: issues(first: 50, states: [${issue_states_string_uppercase}]) {
                                ${return_node_root_infos ? "totalCount" : ""}
                                nodes {
                                    title
                                    bodyUrl
                                    createdAt
                                    updatedAt
                                    url
                                    closedAt
                                    body
                                    lastEditedAt
                                    assignees(first: 10) {
                                        nodes {
                                            avatarUrl
                                            email
                                            login
                                            name
                                            pronouns
                                            url
                                            websiteUrl
                                        }
                                    }
                                    labels(first: 10) {
                                        nodes {
                                            url
                                            name
                                            color
                                            createdAt
                                            updatedAt
                                            description
                                            isDefault
                                        }
                                    }
                                }
                            }
                            ` : ""}
                        }
                    }
                }
            }
        }
    }`
}

/* Testing functions: */

export const GITHUB_ORGANIZATION_BY_NAME = function (login_name: string) { 
    return `{
        organization(login: "${login_name}") {
            login
            name
            description
            email
            url
            
            websiteUrl
            avatarUrl
            
            createdAt
            updatedAt
            isVerified
            location
            
            announcement
            
            packages(first: 10) {
                totalCount
                nodes {
                    name
                    packageType
                    latestVersion {
                        files(first: 10) {
                            nodes {
                                sha256
                                name
                                size
                                updatedAt
                                url
                            }
                        }
                        platform
                        preRelease
                        readme
                        version
                    }
                }
            }

            ${GITHUB_REPOSITORY(GRAMMATICAL_NUMBER.PLURAL)}
            
            teamsUrl
            teams(first: 10) {
                totalCount
                nodes {
                    avatarUrl
                    combinedSlug
                    createdAt
                    updatedAt
                    description
                    membersUrl
                    name
                    slug
                    members(first: 10) {
                        nodes {
                        avatarUrl
                        email
                        login
                        name
                        pronouns
                        url
                        websiteUrl
                        }
                    }
                }
            }
            
            projectsUrl
            projectsV2(first: 100) {
                totalCount
                nodes {
                    number
                    title
                    url
                    createdAt
                    closedAt
                    public
                    readme
                    shortDescription
                    url
                }
            }
        }
    }`;
}

export const GITHUB_ORGANIZATION_REPOSITORY_BY_OWNER_NAME_AND_REPOSITORY_NAME = function (login_name: string, repository_name: string) {
    return `{
        ${GITHUB_REPOSITORY(GRAMMATICAL_NUMBER.SINGULAR, login_name, repository_name)}
    }`
}

export const GITHUB_ORGANIZATION_PROJECT_BY_OWNER_NAME_AND_REPOSITORY_NAME_AND_PROJECT_NAME = function (login_name: string, repository_name: string, project_name: string, view: number) {
    // every project has a repository for its items
    return `{
        repository(owner: "${login_name}", name: "${repository_name}") {
            ${GITHUB_PROJECT(GRAMMATICAL_NUMBER.SINGULAR, project_name, view)}
        }
    }`
}
