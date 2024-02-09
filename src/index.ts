import { Elysia } from "elysia"; // https://elysiajs.com/introduction.html
import { cors } from '@elysiajs/cors'; // https://elysiajs.com/plugins/cors.html
import { html } from '@elysiajs/html'; // https://elysiajs.com/plugins/html.html
import { swagger } from '@elysiajs/swagger'; // https://elysiajs.com/plugins/swagger
import { staticPlugin } from '@elysiajs/static'; // https://github.com/elysiajs/elysia-static
import { GITHUB_ORGS, GITHUB_USERS, GITHUB_INFO, GITHUB_ARRAY_INPUT_TYPES } from "./adapters/github";

const SWAGGER_PATH = "/api";
const HOME_URLS = {
  "api": {
    "swagger": {
      "url": SWAGGER_PATH,
      "name": "Swagger RestApi Docs"
    },
    "download": {
      "url": `${SWAGGER_PATH}/json`,
      "name": "Swagger RestApi OpenAPI Spec",
      "file": "propromo-rest-openapi-spec.json",
      "action": "download"
    }
  },
  "website": {
    "url": "https://propromo.duckdns.org",
    "name": "Website"
  }
} as const;

const DEV_MODE = process?.env?.DEV_MODE === "true";
const CORS_ORIGINS = [
  HOME_URLS.website.url,
  "https://propromo-d08144c627d3.herokuapp.com",
  DEV_MODE ? "http://localhost:5000" : "https://propromo-ts.vercel.app",
]

const ROOT = `
<!DOCTYPE html>
<html lang='en'>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">
        <link rel="icon" href="/favicon.png" type="image/x-icon">
        <title>Propromo RestAPI</title>
    </head>
    <body>
      <h1>Propromo API</h1>

      <h2>Routes:</h2>
      <ul>
        <li><a href="${HOME_URLS.api.swagger.url}">${HOME_URLS.api.swagger.name}</a></li>
        <li><a href="${HOME_URLS.api.download.url}">${HOME_URLS.api.download.name}</a> 
        (<a href="${HOME_URLS.api.download.url}" download="${HOME_URLS.api.download.file}">${HOME_URLS.api.download.action}</a>)
        </li>
        <li><a href="${HOME_URLS.website.url}">${HOME_URLS.website.name}</a></li>
      </ul>
    </body>
</html>`;

const ROOT_PATHS = ["/", "/home", "/root", "/start", "/info", "/about", "/links"];

const ROOT_ROUTES = new Elysia({ prefix: '' });
ROOT_PATHS.forEach((path) => {
  ROOT_ROUTES.get(path, () => ROOT);
});

const app = new Elysia()
  .use(staticPlugin({
    assets: "static",
    prefix: "/"
  }))
  .use(cors({
    origin: CORS_ORIGINS
  }))
  .group('/github', (app) => app
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
  .use(html())
  .use(ROOT_ROUTES)
  .listen(process.env.PORT || 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
