import { App/* , createNodeMiddleware */ } from 'octokit';
/* import { createServer } from "node:http"; */

const GITHUB_APP_ID = process.env.GITHUB_APP_ID as string;
const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET as string;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID as string;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET as string;
const GITHUB_APP_PRIVATE_KEY = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY as String, 'utf-8').toString("utf-8");

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

const webhooks = octokitApp.webhooks; // not triggered?
webhooks.onAny(async ({ id, name, payload }) => {
    console.log(id, name, 'event received');
    console.log("payload", payload);
});

/* createServer(createNodeMiddleware(octokitApp, {
    pathPrefix: "/v1/github/webhooks"
})).listen(3000); */
