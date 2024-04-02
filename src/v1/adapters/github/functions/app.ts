import { App } from 'octokit';

const GITHUB_APP_ID = (process.env.GITHUB_APP_ID ?? process.env.GH_APP_ID) as string;
const GITHUB_APP_WEBHOOK_SECRET = (process.env.GITHUB_APP_WEBHOOK_SECRET ?? process.env.GH_APP_WEBHOOK_SECRET) as string;
const GITHUB_APP_CLIENT_ID = (process.env.GITHUB_APP_CLIENT_ID ?? process.env.GH_APP_CLIENT_ID) as string;
const GITHUB_APP_CLIENT_SECRET = (process.env.GITHUB_APP_CLIENT_SECRET ?? process.env.GH_APP_CLIENT_SECRET) as string;
const GITHUB_APP_PRIVATE_KEY = Buffer.from((process.env.GITHUB_APP_PRIVATE_KEY ?? process.env.GH_APP_PRIVATE_KEY) as string, 'utf-8').toString("utf-8");

export const octokitApp = new App({ // type: "installation"
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_APP_PRIVATE_KEY,
    oauth: {
        clientId: GITHUB_APP_CLIENT_ID,
        clientSecret: GITHUB_APP_CLIENT_SECRET
    },
    webhooks: {
        secret: GITHUB_APP_WEBHOOK_SECRET
    }
});
