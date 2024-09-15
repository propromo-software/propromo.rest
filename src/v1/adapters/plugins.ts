import { Elysia } from "elysia";
import { GITHUB_JWT } from "./github/functions/authenticate";
import bearer from "@elysiajs/bearer";
import { DEV_MODE } from "../../environment";
import { checkForTokenPresence } from "./authenticate";

/* GUARDED ENDPOINTS */

/**
 * Generates a new Elysia plugin with the name 'guardEndpoints-plugin' and the provided endpoints as the seed. The plugin is used to protect routes from being accessed without a bearer token.
 *
 * @param {Elysia} endpoints - the endpoints to use as the seed for the new instance
 * @return {Elysia} the new Elysia instance with additional plugins and guards applied
 */
export const guardEndpoints = (endpoints: Elysia) =>
	new Elysia({
		name: "guardEndpoints-plugin",
		seed: endpoints,
	})
		.use(bearer())
		.use(GITHUB_JWT)
		.guard(
			{
				async beforeHandle({ bearer, set }) {
					const token = checkForTokenPresence(bearer, set);
					if (DEV_MODE) console.log("Token:", token);
				},
			},
			(app) => app.use(endpoints),
		);
