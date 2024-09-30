import { Elysia } from "elysia"; // https://elysiajs.com/introduction.html
import { cors } from "@elysiajs/cors"; // https://elysiajs.com/plugins/cors.html
import { staticPlugin } from "@elysiajs/static"; // https://github.com/elysiajs/elysia-static
import { html } from "@elysiajs/html"; // https://elysiajs.com/plugins/html.html
import { logger } from "@bogeychan/elysia-logger"; // https://www.npmjs.com/package/@bogeychan/elysia-logger

import {
	API_FORWARD_ROUTES,
	CORS_ORIGINS,
	LATEST_SWAGGER_PATH,
	ROOT_ROUTES,
	SWAGGER_PATH,
} from "./config";
import { v1 } from "./v1";
import { PORT } from "./environment";

export const app = new Elysia()
	.use(logger({ autoLogging: true }))
	.use(
		staticPlugin({
			// serve static files from the "static" directory
			assets: "static",
			prefix: "/",
		}),
	)
	.use(
		cors({
			origin: CORS_ORIGINS,
		}),
	)
	.use(html())
	.use(ROOT_ROUTES)

	// VERSIONS
	.use(API_FORWARD_ROUTES)
	.group(SWAGGER_PATH, (app) =>
		app // if no version is specified, redirect to the latest version
			.get("", async ({ redirect }) => {
				return redirect(`/${LATEST_SWAGGER_PATH}`);
			})
			.get(
				"/json",
				async ({ redirect }) => {
					return redirect(`/${LATEST_SWAGGER_PATH}/json`);
				},
				{
					detail: {
						description:
							"No authentication required. Redirects to the latest version of the API documentation in JSON format.",
						tags: ["documentation", "json"],
					},
				},
			),
	)
	.use(v1)
	.listen(PORT);

const currentDate = new Date();
const millisecondsToSubtract = Bun.nanoseconds() / 1000000;
currentDate.setMilliseconds(
	currentDate.getMilliseconds() - millisecondsToSubtract,
);
const startupTime = new Date().getTime() - currentDate.getTime();

console.log(
	`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
	`\n🚀 Startup time: ${startupTime}ms`,
);
