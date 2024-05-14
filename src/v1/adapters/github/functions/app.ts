import { App } from "octokit";
import {
	GITHUB_APP_ID,
	GITHUB_APP_WEBHOOK_SECRET,
	GITHUB_APP_CLIENT_ID,
	GITHUB_APP_CLIENT_SECRET,
	GITHUB_APP_PRIVATE_KEY,
} from "../../../../environment";

export const octokitApp = new App({
	// type: "installation"
	appId: GITHUB_APP_ID,
	privateKey: GITHUB_APP_PRIVATE_KEY,
	oauth: {
		clientId: GITHUB_APP_CLIENT_ID,
		clientSecret: GITHUB_APP_CLIENT_SECRET,
	},
	webhooks: {
		secret: GITHUB_APP_WEBHOOK_SECRET,
	},
});
