export const JIRA_CLOUD_ID = (hosts: string[]) => `query JIRA_CLOUD_ID {
    tenantContexts(hostNames:[${hosts.map((host) => `"${host}"`).join(',')}]) {
        cloudId
    }
}`;

export const JIRA_CLOUD_Projects = (cloudId: string, filter: { types: string[] }) => `query JIRA_CLOUD_Projects {
    jira {
        allJiraProjects(cloudId: "${cloudId}", filter: {types: [${filter.types.map((type) => `${type.toUpperCase()}`).join(',')}]}) {
            pageInfo {
            hasNextPage
            }
            edges {
                node {
                    key
                    name
                }
            }
        }
    }
}`;
