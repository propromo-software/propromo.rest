import { Elysia } from "elysia";
import { GITHUB_JWT, GITHUB_JWT_REALM } from "./functions/authenticate";
import bearer from '@elysiajs/bearer';

/* GUARDED ENDPOINTS */

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
