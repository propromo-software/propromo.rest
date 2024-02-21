import { createNodeMiddleware, createProbot } from "probot";
import app from "./index";

module.exports = createNodeMiddleware(app, {
    probot: createProbot(),
    webhooksPath: "/v1/github/webhooks",
});
