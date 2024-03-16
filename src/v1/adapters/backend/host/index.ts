import { Elysia } from "elysia";
import bearer from '@elysiajs/bearer';
import { Heroku } from "./heroku";

export const PROPROMO_BACKEND_SERVICE = new Elysia({ prefix: '/backend' })
    .use(bearer())
    .post('/drop-and-create-tables', async ({ bearer }) => bearer, {
        async beforeHandle({ bearer, set }) {
            const token = bearer;

            if (!token) {
                set.status = 400
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer, error="invalid_request"`

                return 'Invalid request 💀'
            }

            const validPassword = process.env.DEV_ACCESS_PASSPHRASE === token;

            if (!validPassword) {
                set.status = 401;
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer, error="invalid_token"`;

                return 'Unauthorized 💀';
            } else {
                let result = await Heroku.dropAndCreateTables();
                return result;
            }
        },
        detail: {
            description: "Create and drop tables in the database. 💀",
            tags: ["backend"]
        }
    });
