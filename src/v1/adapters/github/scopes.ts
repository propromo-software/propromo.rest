import { GITHUB_ACCOUNT_SCOPES, GITHUB_MILESTONE_ISSUE_STATES, GITHUB_REPOSITORY_SCOPES, GRAMMATICAL_NUMBER, type PageSize } from "./types";
const DEV_MODE = process.env.DEV_MODE! === "true";

// JS doesn't allow inheriting private (_<property/function>) properties and functions and protected ones (_<property/function>) have getters and setters per default, because they are just a convention and have to be implemented by the programmer :).
// It is not possible to make private properties inheritable in JavaScript, as the private properties of a class are not inherited by its subclasses. This is because private properties are not part of the class's public interface, and they are not accessible from outside the class.
// They are private, because only the fetching functions should be visible for code completion and because ít feels illegal to expose them, because they should only be set and used within the class.
// biome-ignore lint/complexity/noStaticOnlyClass: Prettier like that, who needs speed, am I right?
abstract class AccountFetcher {
    static defaultPageSize = 10;

    static packages(packagePageSize: number, packagesContinueAfter: string | undefined | null, count_nodes = false) { // files(first: 10)
        return `
        packages(first: ${packagePageSize}, after: ${packagesContinueAfter}) {
            ${count_nodes ? "totalCount" : ""}

            pageInfo {
                endCursor
                hasNextPage
            }

            nodes {
                name
                packageType
                latestVersion {
                    files(first: 10) {
                        ${count_nodes ? "totalCount" : ""}

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
        `;
    }

    static projects(packagePageSize: number, packagesContinueAfter: string | undefined | null, count_nodes = false) {
        return `
        projectsUrl
        projectsV2(first: ${packagePageSize}, after: ${packagesContinueAfter}) {
            ${count_nodes ? "totalCount" : ""}

            pageInfo {
                endCursor
                hasNextPage
            }
    
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
        `
    }
}

export class OrganizationFetcher {
    #name: string;

    get name() {
        return this.#name;
    }

    #doFetchEssential = true;
    #doFetchInfo = false;
    #doFetchPackages = false;
    #doFetchProjects = false;

    #packagePageSize: number;
    #projectPageSize: number;

    #packagesContinueAfter: string | undefined | null = null;
    #projectsContinueAfter: string | undefined | null = null;

    #count_nodes = false;
    #log = false;

    constructor(name: string, scopes: PageSize<GITHUB_ACCOUNT_SCOPES>[]) {
        this.#log = DEV_MODE;
        this.#count_nodes = DEV_MODE;

        this.#name = name;

        this.#packagePageSize = AccountFetcher.defaultPageSize;
        this.#projectPageSize = AccountFetcher.defaultPageSize;

        this.#parseScopes(scopes);
    }

    #parseScopes(pageSizes: PageSize<GITHUB_ACCOUNT_SCOPES>[]) {
        if (this.#log) console.info("parsing scopes");

        for (const ps of pageSizes) {
            switch (ps.scopeName) {
                case GITHUB_ACCOUNT_SCOPES.ESSENTIAL:
                    this.#doFetchEssential = true;
                    break;
                case GITHUB_ACCOUNT_SCOPES.INFO:
                    this.#doFetchInfo = true;
                    break;
                case GITHUB_ACCOUNT_SCOPES.PACKAGES:
                    this.#doFetchPackages = true;
                    this.#packagePageSize = ps.pageSize;
                    this.#packagesContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_ACCOUNT_SCOPES.PROJECTS:
                    this.#doFetchProjects = true;
                    this.#projectPageSize = ps.pageSize;
                    this.#projectsContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                default:
                    break;
            }
        }
    }

    #validateCursor(continueAfter: string | undefined | null) {
        if (continueAfter && continueAfter !== "null" && continueAfter !== "undefined") {
            return `"${continueAfter}"`;
        }

        return null;
    }

    getQuery() {
        if (this.#log) console.info("settings: ", {
            doFetchEssential: this.#doFetchEssential,
            doFetchInfo: this.#doFetchInfo,
            doFetchPackages: this.#doFetchPackages,
            doFetchProjects: this.#doFetchProjects,
            packagePageSize: this.#packagePageSize,
            projectPageSize: this.#projectPageSize,
            packagesContinueAfter: this.#packagesContinueAfter,
            projectsContinueAfter: this.#projectsContinueAfter,
            count_nodes: this.#count_nodes,
            log: this.#log
        });

        const query = `{
            organization(login: "${this.#name}") {
                login
                ${this.#essentialBody()}
                ${this.#infoBody()}
                ${this.#packagesBody()}
                ${this.#projectsBody()}
            }
        }`

        if (this.#log) console.info(query);
        return query;
    }

    #essentialBody() {
        if (this.#doFetchEssential) {
            if (this.#log) console.info("fetching essential");

            return `
            name
            description
            url
            avatarUrl
            `;
        }

        return "";
    }

    #infoBody() {
        if (this.#doFetchInfo) {
            if (this.#log) console.info("fetching info");

            return `
            login
            email
            
            websiteUrl
            
            createdAt
            updatedAt
            isVerified
            location
            
            announcement
            `;
        }

        return "";
    }

    #packagesBody() {
        if (this.#doFetchPackages) {
            if (this.#log) console.info("fetching packages");

            return AccountFetcher.packages(this.#projectPageSize, this.#projectsContinueAfter, this.#count_nodes);
        }

        return "";
    }

    #projectsBody() {
        if (this.#doFetchProjects) {
            if (this.#log) console.info("fetching projects");

            return AccountFetcher.projects(this.#packagePageSize, this.#packagesContinueAfter, this.#count_nodes);
        }

        return "";
    }
}

export class UserFetcher {
    #name: string;

    get name() {
        return this.#name;
    }

    #doFetchEssential = true;
    #doFetchInfo = false;
    #doFetchPackages = false;
    #doFetchProjects = false;

    #packagePageSize: number;
    #projectPageSize: number;

    #packagesContinueAfter: string | undefined | null = null;
    #projectsContinueAfter: string | undefined | null = null;

    #count_nodes = false;
    #log = false;

    constructor(name: string, scopes: PageSize<GITHUB_ACCOUNT_SCOPES>[]) {
        this.#log = DEV_MODE;
        this.#count_nodes = DEV_MODE;

        this.#name = name;

        this.#packagePageSize = AccountFetcher.defaultPageSize;
        this.#projectPageSize = AccountFetcher.defaultPageSize;

        this.#parseScopes(scopes);
    }

    #parseScopes(pageSizes: PageSize<GITHUB_ACCOUNT_SCOPES>[]) {
        if (this.#log) console.info("parsing scopes");

        for (const ps of pageSizes) {
            switch (ps.scopeName) {
                case GITHUB_ACCOUNT_SCOPES.ESSENTIAL:
                    this.#doFetchEssential = true;
                    break;
                case GITHUB_ACCOUNT_SCOPES.INFO:
                    this.#doFetchInfo = true;
                    break;
                case GITHUB_ACCOUNT_SCOPES.PACKAGES:
                    this.#doFetchPackages = true;
                    this.#packagePageSize = ps.pageSize;
                    this.#packagesContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_ACCOUNT_SCOPES.PROJECTS:
                    this.#doFetchProjects = true;
                    this.#projectPageSize = ps.pageSize;
                    this.#projectsContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                default:
                    break;
            }
        }
    }

    #validateCursor(continueAfter: string | undefined | null) {
        if (continueAfter && continueAfter !== "null" && continueAfter !== "undefined") {
            return `"${continueAfter}"`;
        }

        return null;
    }

    getQuery() {
        if (this.#log) console.info("settings: ", {
            doFetchEssential: this.#doFetchEssential,
            doFetchInfo: this.#doFetchInfo,
            doFetchPackages: this.#doFetchPackages,
            doFetchProjects: this.#doFetchProjects,
            packagePageSize: this.#packagePageSize,
            projectPageSize: this.#projectPageSize,
            packagesContinueAfter: this.#packagesContinueAfter,
            projectsContinueAfter: this.#projectsContinueAfter,
            count_nodes: this.#count_nodes,
            log: this.#log
        });

        const query = `{
            user(login: "${this.#name}") {
                login
                ${this.#essentialBody()}
                ${this.#infoBody()}
                ${this.#packagesBody()}
                ${this.#projectsBody()}
            }
        }`

        if (this.#log) console.info(query);
        return query;
    }

    #projectsBody() {
        if (this.#doFetchProjects) {
            if (this.#log) console.info("fetching projects");

            return AccountFetcher.projects(this.#projectPageSize, this.#projectsContinueAfter, this.#count_nodes);
        }

        return "";
    }

    #packagesBody() {
        if (this.#doFetchPackages) {
            if (this.#log) console.info("fetching packages");

            return AccountFetcher.packages(this.#packagePageSize, this.#packagesContinueAfter, this.#count_nodes);
        }

        return "";
    }

    #infoBody() { // socialAccounts(first: 10)
        if (this.#doFetchInfo) {
            if (this.#log) console.info("fetching info");

            return `
            bio
            websiteUrl
            createdAt

            status {
                message
                emoji
                indicatesLimitedAvailability
            }
            socialAccounts(first: 10) {
                ${this.#count_nodes ? "totalCount" : ""}

                pageInfo {
                    endCursor
                    hasNextPage
                }

                nodes {
                    provider
                    displayName
                    url
                }
            }
            `;
        }

        return "";
    }

    #essentialBody() {
        if (this.#doFetchEssential) {
            if (this.#log) console.info("fetching essential");

            return `
            name
            pronouns
            location
            avatarUrl
            url
            company
            email
            `;
        }

        return "";
    }
}

export class Repository {
    #name: string | null = null;

    get name() {
        return this.#name;
    }

    #doFetchEssential = true;
    #doFetchInfo = false;
    #doFetchLicense = false;
    #doFetchVulnerabilities = false;
    #doFetchTopics = false;
    #doFetchLabels = false;
    #doFetchReleases = false;
    #doFetchDeployments = false;
    #doFetchLanguages = false;
    #doFetchMilestones = false;
    #doFetchIssues = false;

    static defaultPageSize = 10;
    #rootPageSize: number;
    #vulnerabilitiesPageSize: number;
    #topicsPageSize: number;
    #labelsPageSize: number;
    #releasesPageSize: number;
    #deploymentsPageSize: number;
    #languagesPageSize: number;
    #milestonesPageSize: number;
    #issuesPageSize: number;

    #rootContinueAfter: string | undefined | null = null;
    #vulnerabilitiesContinueAfter: string | undefined | null = null;
    #topicsContinueAfter: string | undefined | null = null;
    #labelsContinueAfter: string | undefined | null = null;
    #releasesContinueAfter: string | undefined | null = null;
    #deploymentsContinueAfter: string | undefined | null = null;
    #languagesContinueAfter: string | undefined | null = null;
    #milestonesContinueAfter: string | undefined | null = null;
    #issuesContinueAfter: string | undefined | null = null;

    #count_nodes = false;
    #log = false;

    constructor(args:
        { name: string, scopes: PageSize<GITHUB_REPOSITORY_SCOPES>[] } |
        { scopes: PageSize<GITHUB_REPOSITORY_SCOPES>[] }
    ) {
        this.#log = DEV_MODE;

        if ("name" in args) {
            this.#name = args.name;
        }

        this.#rootPageSize = Repository.defaultPageSize;
        this.#vulnerabilitiesPageSize = Repository.defaultPageSize;
        this.#topicsPageSize = Repository.defaultPageSize;
        this.#labelsPageSize = Repository.defaultPageSize;
        this.#releasesPageSize = Repository.defaultPageSize;
        this.#deploymentsPageSize = Repository.defaultPageSize;
        this.#languagesPageSize = Repository.defaultPageSize;
        this.#milestonesPageSize = Repository.defaultPageSize;
        this.#issuesPageSize = Repository.defaultPageSize;

        this.#parseScopes(args.scopes);
    }

    #parseScopes(pageSizes: PageSize<GITHUB_REPOSITORY_SCOPES>[]) {
        if (this.#log) console.info("parsing scopes");

        for (const ps of pageSizes) {
            switch (ps.scopeName) { // if the scope doesn't have children, pageSize and continueAfter is for the root (repositories)
                case GITHUB_REPOSITORY_SCOPES.ESSENTIAL:
                    this.#rootPageSize = ps.pageSize ?? this.#rootPageSize;
                    this.#rootContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.INFO:
                    this.#doFetchInfo = true;
                    this.#rootPageSize = ps.pageSize ?? this.#rootPageSize;
                    this.#rootContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.DEPLOYMENTS:
                    this.#doFetchDeployments = true;
                    this.#deploymentsPageSize = ps.pageSize;
                    this.#deploymentsContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.LABELS:
                    this.#doFetchLabels = true;
                    this.#labelsPageSize = ps.pageSize;
                    this.#labelsContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.RELEASES:
                    this.#doFetchReleases = true;
                    this.#releasesPageSize = ps.pageSize;
                    this.#releasesContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.TOPICS:
                    this.#doFetchTopics = true;
                    this.#topicsPageSize = ps.pageSize;
                    this.#topicsContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.VULNERABILITIES:
                    this.#doFetchVulnerabilities = true;
                    this.#vulnerabilitiesPageSize = ps.pageSize;
                    this.#vulnerabilitiesContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.LANGUAGES:
                    this.#doFetchLanguages = true;
                    this.#languagesPageSize = ps.pageSize;
                    this.#languagesContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.MILESTONES:
                    this.#doFetchMilestones = true;
                    this.#milestonesPageSize = ps.pageSize;
                    this.#milestonesContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.ISSUES:
                    this.#doFetchIssues = true;
                    this.#issuesPageSize = ps.pageSize;
                    this.#issuesContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.LICENSE:
                    this.#doFetchLicense = true;
                    this.#rootPageSize = ps.pageSize ?? this.#rootPageSize;
                    this.#rootContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                case GITHUB_REPOSITORY_SCOPES.COUNT:
                    this.#count_nodes = true;
                    this.#rootPageSize = ps.pageSize ?? this.#rootPageSize;
                    this.#rootContinueAfter = this.#validateCursor(ps.continueAfter);
                    break;
                default:
                    break;
            }
        }
    }

    #validateCursor(continueAfter: string | undefined | null) {
        if (continueAfter && continueAfter !== "null" && continueAfter !== "undefined") {
            return `"${continueAfter}"`;
        }

        return null;
    }

    getQuery(issues_states: GITHUB_MILESTONE_ISSUE_STATES[] | null = null, milestones_amount: GRAMMATICAL_NUMBER = GRAMMATICAL_NUMBER.PLURAL, milestone_number: number | null = null) {
        const final_issue_states = issues_states ?? [GITHUB_MILESTONE_ISSUE_STATES.OPEN, GITHUB_MILESTONE_ISSUE_STATES.CLOSED];
        let query = this.#getInfoQuery();

        if (this.#doFetchMilestones || this.#doFetchIssues) {
            if (this.#log) console.info("fetching milestones and/or issues");

            query = this.#getIssuesQuery(final_issue_states, milestones_amount, milestone_number);
        }

        if (this.#log) console.info(query);

        return query;
    }

    #getInfoQuery() {
        if (this.#name) {
            return `
                repository(name: "${this.#name}") {
                    ${this.#essentialBody()}
                    ${this.#infoBody()}
    
                    ${this.#licenseBody()}
                    ${this.#vulnerabilitiesBody()}
                    ${this.#topicsBody()}
                    ${this.#labelsBody()}
                    ${this.#releasesBody()}
                    ${this.#deploymentsBody()}
                    ${this.#languagesBody()}
                }
            `;
        }

        return `
        repositories(first: ${this.#rootPageSize}, after: ${this.#rootContinueAfter}) {
            ${this.#count_nodes ? "totalCount" : ""}

            pageInfo {
                endCursor
                hasNextPage
            }

            nodes {
                ${this.#essentialBody()}
                ${this.#infoBody()}

                ${this.#licenseBody()}
                ${this.#vulnerabilitiesBody()}
                ${this.#topicsBody()}
                ${this.#labelsBody()}
                ${this.#releasesBody()}
                ${this.#deploymentsBody()}
                ${this.#languagesBody()}
            }
        }`;
    }

    #getIssuesQuery(issues_states: GITHUB_MILESTONE_ISSUE_STATES[] | null = null, milestones_amount: GRAMMATICAL_NUMBER = GRAMMATICAL_NUMBER.PLURAL, milestone_number: number | null = null) {
        if (this.#name) {
            return `
                repository(name: "${this.#name}") {
                    ${this.#essentialBody()}
                    ${this.#infoBody()}
    
                    ${this.#licenseBody()}
                    ${this.#vulnerabilitiesBody()}
                    ${this.#topicsBody()}
                    ${this.#labelsBody()}
                    ${this.#releasesBody()}
                    ${this.#deploymentsBody()}
                    ${this.#languagesBody()}

                    ${this.#milestonesBody(issues_states ?? [GITHUB_MILESTONE_ISSUE_STATES.OPEN], milestones_amount, milestone_number)}
                }
            `;
        }

        return `
        repositories(first: ${this.#rootPageSize}, after: ${this.#rootContinueAfter}) {
            ${this.#count_nodes ? "totalCount" : ""}

            pageInfo {
                endCursor
                hasNextPage
            }

            nodes {
                ${this.#essentialBody()}
                ${this.#infoBody()}

                ${this.#licenseBody()}
                ${this.#vulnerabilitiesBody()}
                ${this.#topicsBody()}
                ${this.#labelsBody()}
                ${this.#releasesBody()}
                ${this.#deploymentsBody()}
                ${this.#languagesBody()}
                
                ${this.#milestonesBody(issues_states ?? [GITHUB_MILESTONE_ISSUE_STATES.OPEN], milestones_amount, milestone_number)}
            }
        }`;
    }

    #essentialBody() {
        if (this.#doFetchEssential) {
            if (this.#log) console.info("fetching essential infos");

            return `
            name
            description
            `;
        }

        return "";
    }

    #infoBody() {
        if (this.#doFetchInfo) {
            if (this.#log) console.info("fetching info");

            return `
            updatedAt
            createdAt
            isArchived
            isPrivate
            isTemplate
            
            resourcePath
            homepageUrl
            sshUrl
            projectsUrl
            `;
        }

        return "";
    }

    #licenseBody() {
        if (this.#doFetchLicense) {
            if (this.#log) console.info("fetching license");

            return `
            licenseInfo {
                url
                spdxId
                name
                nickname
                description
                conditions {
                    description
                    key
                    label
                }
            }
            `;
        }

        return "";
    }

    #vulnerabilitiesBody() {
        if (this.#doFetchVulnerabilities) {
            if (this.#log) console.info("fetching vulnerabilities");

            return `
            vulnerabilityAlerts(first: ${this.#vulnerabilitiesPageSize}, after: ${this.#vulnerabilitiesContinueAfter}) {
                ${this.#count_nodes ? "totalCount" : ""}

                pageInfo {
                    endCursor
                    hasNextPage
                }

                nodes {
                    createdAt
                    fixedAt
                    dependencyScope
                    securityVulnerability {
                        vulnerableVersionRange
                        updatedAt
                        advisory {
                            classification
                            description
                            publishedAt
                            summary
                            updatedAt
                            updatedAt
                        }
                        
                        firstPatchedVersion {
                            identifier
                        }
                        package {
                            ecosystem
                            name
                        }
                    }
                    dependabotUpdate {
                        error {
                            title
                            body
                            errorType
                        }
                    }
                }
            }
            `;
        }

        return "";
    }

    #topicsBody() {
        if (this.#doFetchTopics) {
            if (this.#log) console.info("fetching topics");

            return `
            repositoryTopics(first: ${this.#topicsPageSize}, after: ${this.#topicsContinueAfter}) {
                ${this.#count_nodes ? "totalCount" : ""}

                pageInfo {
                    endCursor
                    hasNextPage
                }

                nodes {
                    topic {
                        name
                    }
                    url
                }
            }
            `;
        }

        return "";
    }

    #labelsBody() {
        if (this.#doFetchLabels) {
            if (this.#log) console.info("fetching labels");

            return `
            labels(first: ${this.#labelsPageSize}, after: ${this.#labelsContinueAfter}) {
                ${this.#count_nodes ? "totalCount" : ""}

                pageInfo {
                    endCursor
                    hasNextPage
                }

                nodes {
                    color
                    createdAt
                    description
                    name
                    url
                }
            }
            `;
        }

        return "";
    }

    #releasesBody() { // releaseAssets(first: 100)
        if (this.#doFetchReleases) {
            if (this.#log) console.info("fetching releases");

            return `
            releases(first: ${this.#releasesPageSize}, after: ${this.#releasesContinueAfter}) {
                ${this.#count_nodes ? "totalCount" : ""}

                pageInfo {
                    endCursor
                    hasNextPage
                }
            
                nodes {
                    name
                    createdAt
                    description
                    isDraft
                    isLatest
                    isPrerelease
                    name
                    tagName
                    updatedAt
                    url
                    tag {
                        name
                    }
                    tagCommit {
                        additions
                        deletions
                        authoredDate
                        changedFilesIfAvailable
                        author {
                            avatarUrl
                            email
                            name
                        }
                    }
                    releaseAssets(first: 100) {
                        ${this.#count_nodes ? "totalCount" : ""}

                        pageInfo {
                            endCursor
                            hasNextPage
                        }

                        nodes {
                            contentType
                            createdAt
                            downloadCount
                            name
                            size
                            updatedAt
                        }
                    }
                }
            }
            `;
        }

        return "";
    }

    #deploymentsBody() { // statuses(first: 3)
        if (this.#doFetchDeployments) {
            if (this.#log) console.info("fetching deployments");

            return `
            deployments(first: ${this.#deploymentsPageSize}, after: ${this.#deploymentsContinueAfter}) {
                ${this.#count_nodes ? "totalCount" : ""}

                pageInfo {
                    endCursor
                    hasNextPage
                }

                nodes {
                    updatedAt
                    createdAt
                    updatedAt
                    description
                    environment
                    task
                    latestStatus {
                        createdAt
                        updatedAt
                        description
                        logUrl
                        environmentUrl
                        state
                        deployment {
                            createdAt
                            description
                            commit {
                                additions
                                deletions
                                authoredDate
                                changedFilesIfAvailable
                                author {
                                    avatarUrl
                                    email
                                    name
                                }
                            }
                        }
                    }
                    statuses(first: 3) {
                        ${this.#count_nodes ? "totalCount" : ""}

                        pageInfo {
                            endCursor
                            hasNextPage
                        }

                        nodes {
                            createdAt
                            updatedAt
                            description
                            logUrl
                            environmentUrl
                            state
                            deployment {
                                createdAt
                                description
                                commit {
                                    additions
                                    deletions
                                    authoredDate
                                    changedFilesIfAvailable
                                    author {
                                        avatarUrl
                                        email
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
            `;
        }

        return "";
    }

    #languagesBody() {
        if (this.#doFetchLanguages) {
            if (this.#log) console.info("fetching languages");

            return `
            primaryLanguage {
                color
                name
            }

            languages(first: ${this.#languagesPageSize}, after: ${this.#languagesContinueAfter}) {
                ${this.#count_nodes ? "totalCount" : ""}

                pageInfo {
                    endCursor
                    hasNextPage
                }

                nodes {
                    color
                    name
                }
            }
            `;
        }

        return "";
    }

    /**
     * Supports both issues and milestones.
     */
    #milestonesBody(issues_state: GITHUB_MILESTONE_ISSUE_STATES[], milestones_amount: GRAMMATICAL_NUMBER = GRAMMATICAL_NUMBER.PLURAL, milestone_number: number | null = null) {
        const IS_SINGULAR = milestones_amount === GRAMMATICAL_NUMBER.SINGULAR;
        const head = IS_SINGULAR && milestone_number ?
            `milestone(number: ${milestone_number})` :
            `milestones(first: ${this.#milestonesPageSize}, after: ${this.#milestonesContinueAfter})`;

        const info_body = `
        number
        createdAt
        closedAt
        description
        dueOn
        progressPercentage
        title
        updatedAt
        url
        state
        `;

        if (this.#doFetchMilestones) {
            if (this.#log) console.info("fetching milestones and issues");

            return `
                ${head} {
                    ${IS_SINGULAR ? `
                    ${info_body}

                    ${this.#issuesBody(issues_state)}
                    ` : `
                    ${this.#count_nodes ? "totalCount" : ""}
                    
                    pageInfo {
                        endCursor
                        hasNextPage
                    }

                    nodes {
                        ${info_body}
        
                        ${this.#issuesBody(issues_state)}
                    }
                    `}
                }`;
        }

        if (this.#doFetchIssues) {
            if (this.#log) console.info("fetching issues");

            return this.#issuesBody(issues_state);
        }

        return "";
    }

    #issuesBody(state: GITHUB_MILESTONE_ISSUE_STATES[]) {
        if (this.#doFetchIssues) {
            const fetchOpen = state.includes(GITHUB_MILESTONE_ISSUE_STATES.OPEN);
            const fetchClosed = state.includes(GITHUB_MILESTONE_ISSUE_STATES.CLOSED);

            const open = `
                open_issues: issues(first: ${this.#issuesPageSize}, states: [OPEN], after: ${this.#issuesContinueAfter}) {
                    ${this.#issuesNodes()}
                }`;

            const closed = `
                closed_issues: issues(first: ${this.#issuesPageSize}, states: [CLOSED], after: ${this.#issuesContinueAfter}) {
                    ${this.#issuesNodes()}
                }`;

            return `
                ${fetchOpen ? open : ""}
                ${fetchClosed ? closed : ""}
                `;
        }

        return "";
    }

    #issuesNodes() { // labels(first: 4)
        if (this.#doFetchIssues) {
            return `
                ${this.#count_nodes ? "totalCount" : ""}

                pageInfo {
                    endCursor
                    hasNextPage
                }

                nodes {
                    title
                    bodyUrl
                    createdAt
                    updatedAt
                    url
                    closedAt
                    body
                    lastEditedAt
                    labels(first: 4) {
                        ${this.#count_nodes ? "totalCount" : ""}

                        pageInfo {
                            endCursor
                            hasNextPage
                        }
                        
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
                }`;
        }

        return "";
    }
}
