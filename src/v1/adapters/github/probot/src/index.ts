import { Probot } from "probot";

// https://probot.github.io/docs/webhooks
// https://github.com/octokit/webhooks.js/#webhook-events
export = (app: Probot) => {
  app.onAny(async (context) => {
    // https://probot.github.io/docs/github-api
    app.log.info({ event: context.name, payload: context.payload });

    // inform elysiajs microservice that a change has been made to the repository
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
