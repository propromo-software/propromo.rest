import { Elysia } from "elysia";

export const LATEST_MAJOR_VERSION = "v1";
export const SWAGGER_PATH = "api";
export const SWAGGER_PATH_EXCLUDE = [
    `/${LATEST_MAJOR_VERSION}/${SWAGGER_PATH}`
];
export const LATEST_SWAGGER_PATH = `${LATEST_MAJOR_VERSION}/${SWAGGER_PATH}`;
export const HOME_URLS = {
    "api": {
        "swagger": {
            "url": LATEST_SWAGGER_PATH,
            "name": "Swagger RestApi Docs"
        },
        "download": {
            "url": `${LATEST_SWAGGER_PATH}/json`,
            "name": "Swagger RestApi OpenAPI Spec",
            "file": "propromo-rest-openapi-spec.json",
            "action": "download"
        }
    },
    "website": {
        "url": "https://propromo.duckdns.org",
        "name": "Website"
    },
    "apps": {
        "github": {
            "url": "https://github.com/apps/propromo-software",
            "name": "Github App"
        }
    }
} as const;

export const DEV_MODE = process?.env?.DEV_MODE === "true";
export const CORS_ORIGINS = [
    HOME_URLS.website.url,
    "https://propromo-d08144c627d3.herokuapp.com",
    DEV_MODE ? "http://localhost:5000" : "https://propromo-ts.vercel.app",
]

export const ROOT = `
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
        <li><a href="${HOME_URLS.apps.github.url}">${HOME_URLS.apps.github.name}</a></li>
      </ul>
    </body>
</html>`;

export const ROOT_PATHS = ["/", "/home", "/root", "/start", "/info", "/about", "/links"];

export const ROOT_ROUTES = new Elysia({ prefix: '' });
ROOT_PATHS.forEach((path) => {
    ROOT_ROUTES.get(path, () => ROOT);
});
