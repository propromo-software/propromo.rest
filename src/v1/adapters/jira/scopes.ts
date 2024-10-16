const JIRA_CLOUD_PAGE_INFO = `
pageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
}
`;

const JIRA_CLOUD_NODES_INFO = `
totalCount
`;

export const JIRA_CLOUD_ID = (hosts: string[]) => `query JIRA_CLOUD_ID {
    tenantContexts(hostNames:[${hosts.map((host) => `"${host}"`).join(",")}]) {
        cloudId
    }
}`;

export const JIRA_CLOUD = (name: string, children: string) => {
	return `query ${name} {
        jira {
            ${children}
        }
    }`;
};

type JIRA_CLOUD_PROJECTS_GRAPHQL_OPTIONS = {
	name: string;
	children: string;
};

export const JIRA_CLOUD_PROJECTS = (
	cloudId: string,
	filter: { types: string[] },
	options: JIRA_CLOUD_PROJECTS_GRAPHQL_OPTIONS = {
		name: "JIRA_CLOUD_PROJECTS",
		children: "",
	},
) =>
	JIRA_CLOUD(
		options.name,
		`
allJiraProjects(cloudId: "${cloudId}", filter: {types: [${filter.types.map((type) => `${type.toUpperCase()}`).join(",")}]}) {
    pageInfo {
        hasNextPage
    }
    edges {
        node {
            id
            key
            name
            description
            avatar {
              large
            }
            webUrl

            status
            created
            lastUpdated

            projectType
            projectTypeName

            ${options.children}
        }
    }
}
`,
	);

export const JIRA_CLOUD_PROJECTS_LEAD = (
	cloudId: string,
	filter: { types: string[] },
) =>
	JIRA_CLOUD_PROJECTS(cloudId, filter, {
		name: "JIRA_PROJECTS_LEAD",
		children: `lead {
            name
            picture
            canonicalAccountId
            accountStatus
        }`,
	});
