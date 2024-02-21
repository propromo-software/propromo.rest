import { swagger } from '@elysiajs/swagger'; // https://elysiajs.com/plugins/swagger
import { GITHUB_ORGS, GITHUB_USERS, GITHUB_INFO, GITHUB_ARRAY_INPUT_TYPES, GITHUB_APP_AUTHENTICATION } from "./adapters/github";
import { Elysia } from "elysia";
import { SWAGGER_PATH, ROOT_PATHS } from '../config';

export const V1 = new Elysia({ prefix: '/v1' })
    .group('/github', (app) => app
        .use(GITHUB_APP_AUTHENTICATION)
        .use(GITHUB_ORGS)
        .use(GITHUB_USERS)
        .use(GITHUB_INFO) // remove
        .use(GITHUB_ARRAY_INPUT_TYPES)
    )
    .use(swagger({
        path: SWAGGER_PATH,
        exclude: [...ROOT_PATHS, SWAGGER_PATH, new RegExp("(\/github\/info\/)[A-Za-z\/{_}]*")],
        documentation: {
            info: {
                title: 'Propromo RestAPI Documentation',
                description: 'A RestAPI for the scopes of the Github GraphqlAPI, that Propromo needs.',
                version: '1.0.0',
            },
            tags: [
                { name: 'github', description: 'used for fetching info from the Github GraphQl API' },
                { name: 'authentication', description: 'auth' },
                { name: 'organization', description: 'organization' },
                { name: 'projects', description: 'organization or user projects' },
                { name: 'repositories', description: 'project repositories' },
                { name: 'milestones', description: 'project milestones' },
                { name: 'views', description: 'project views' },
                { name: 'scoped', description: 'enum list can be passed in' },
                { name: 'types', description: 'type info scopes' }
            ]
        }
    }))