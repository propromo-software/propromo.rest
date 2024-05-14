import {
	GITHUB_ACCOUNT_SCOPES,
	GITHUB_PROJECT_SCOPES,
	GITHUB_REPOSITORY_SCOPES,
} from "./types";

export const GITHUB_ACCOUNT_PARAMS = JSON.stringify(
	Object.values(GITHUB_ACCOUNT_SCOPES),
);
export const GITHUB_PROJECT_PARAMS = JSON.stringify(
	Object.values(GITHUB_PROJECT_SCOPES),
);
export const GITHUB_REPOSITORY_PARAMS = JSON.stringify(
	Object.values(GITHUB_REPOSITORY_SCOPES),
);
