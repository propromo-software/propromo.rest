import { JIRA_CLOUD_ID } from "./scopes";

export const Tenant = (hosts: string[]) => {
	return JIRA_CLOUD_ID(hosts);
};

export const Project = () => {
	return "";
};

export const Projects = () => {
	return "";
};
