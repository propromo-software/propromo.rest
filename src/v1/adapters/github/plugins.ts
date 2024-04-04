import { Elysia } from "elysia";
import { GITHUB_JWT, GITHUB_JWT_REALM } from "./functions/authenticate";
import bearer from '@elysiajs/bearer';

/* GUARDED ENDPOINTS */

/**
 * Generates a new Elysia plugin with the name 'guardEndpoints-plugin' and the provided endpoints as the seed. The plugin is used to protect routes from being accessed without a bearer token.
 *
 * @param {Elysia} endpoints - the endpoints to use as the seed for the new instance
 * @return {Elysia} the new Elysia instance with additional plugins and guards applied
 */
export const guardEndpoints = (endpoints: Elysia) => new Elysia({
    name: 'guardEndpoints-plugin',
    seed: endpoints
})
    .use(bearer())
    .use(GITHUB_JWT)
    .guard(
        {
            async beforeHandle({ bearer, set }) {
                if (!bearer) {
                    set.status = 400
                    set.headers[
                        'WWW-Authenticate'
                    ] = `Bearer realm='${GITHUB_JWT_REALM}', error="invalid_request"`

                    return 'Unauthorized'
                }
            }
        },
        (app) => app
            .use(endpoints)
    );
