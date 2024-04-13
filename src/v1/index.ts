import { Elysia } from "elysia";
import { swagger } from '@elysiajs/swagger';

import { SWAGGER_PATH, ROOT_PATHS, SWAGGER_PATH_EXCLUDE, V1_PATH } from '../config';
import { GITHUB_APP_WEBHOOKS, GITHUB_GENERAL, GITHUB_ORGS, GITHUB_USERS } from "./adapters/github";
import { GITHUB_APP_AUTHENTICATION } from "./adapters/github/functions/authenticate";
import { PROPROMO_BACKEND_SERVICE } from './adapters/backend/host';

export const v1 = new Elysia({ prefix: `/${V1_PATH}` })
    .use(PROPROMO_BACKEND_SERVICE)
    .group('/github', (app) => app
        .use(GITHUB_APP_AUTHENTICATION)
        .use(GITHUB_APP_WEBHOOKS)
        .use(GITHUB_GENERAL)
        .use(GITHUB_ORGS)
        .use(GITHUB_USERS)
    )
    .use(swagger({
        scalarVersion: "1.17.11",
        path: SWAGGER_PATH,
        exclude: [
            ...ROOT_PATHS,
            ...SWAGGER_PATH_EXCLUDE,
            // biome-ignore lint/complexity/useRegexLiterals:
            new RegExp("(\/github\/webhooks\/)[A-Za-z\/{_}]*")
        ],
        documentation: {
            info: {
                title: 'Propromo RestAPI Documentation',
                description: 'A RestAPI for the scopes of the Github GraphqlAPI, that Propromo needs (latest).',
                version: '1.0.10',
            },
            tags: [
                { name: 'github', description: 'Used for fetching info from the Github GraphQl API.' },
                { name: 'authentication', description: 'Authenticate here first, to send requests to protected endpoints.' },
                { name: 'backend', description: 'Interact with the production environment. Accessible with a developer passphrase.' }
            ]
        },
        scalarConfig: {
            metaData: {
                ogImage: {
                    url: 'http://localhost:3000/favicon.png',
                    secureUrl: 'https://rest-microservice.onrender.com/favicon.png',
                    type: "image/png",
                    width: 512,
                    height: 512,
                    alt: "favicon"
                }
            }
        }
    }))
