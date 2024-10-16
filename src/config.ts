import { Elysia } from "elysia";
import { DEV_MODE } from "./environment";

// API settings
export const V1_PATH = "v1";
export const LATEST_MAJOR_VERSION = V1_PATH;
export const API_PATHS = [V1_PATH];
export const SWAGGER_PATH = "api";
export const LATEST_SWAGGER_PATH = `${LATEST_MAJOR_VERSION}/${SWAGGER_PATH}`;
export const V1_SWAGGER_PATH = `${V1_PATH}/${SWAGGER_PATH}`;
export const SWAGGER_PATH_EXCLUDE = [`/${V1_PATH}/${SWAGGER_PATH}`];

// Home Page URLs
export const HOME_URLS = {
	api: {
		swagger: {
			url: LATEST_SWAGGER_PATH,
			name: "Swagger RestApi Docs [LATEST]",
			versions: {
				url: {
					v1: `${V1_SWAGGER_PATH}`,
				},
				name: {
					v1: "latest/production",
				},
			},
		},
		download: {
			url: `${LATEST_SWAGGER_PATH}/json`,
			name: "Swagger RestApi OpenAPI Spec [LATEST]",
			file: "propromo-rest-openapi-spec.json",
			action: "download",
			versions: {
				url: {
					v1: `${V1_SWAGGER_PATH}/json`,
				},
				name: {
					v1: "latest/production",
				},
				file: {
					v1: "propromo-rest-openapi-spec-v1.json",
				},
			},
		},
	},
	website: {
		url: "https://propromo.duckdns.org",
		name: "Website",
	},
	apps: {
		github: {
			url: "https://github.com/apps/propromo-software",
			name: "Github App",
		},
	},
} as const;

// CORS settings for development and production servers
export const CORS_ORIGINS = DEV_MODE
	? ["http://localhost:5000"]
	: [
		HOME_URLS.website.url,
		"https://propromo-d08144c627d3.herokuapp.com",
		"https://propromo-ts.vercel.app",
	];

// Home Page
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
        <ol>
            <li>[v1] ${HOME_URLS.api.swagger.versions.name.v1}: <a href="${HOME_URLS.api.swagger.versions.url.v1}">${HOME_URLS.api.swagger.versions.url.v1}</a></li>
        </ol>
        <li><a href="${HOME_URLS.api.download.url}">${HOME_URLS.api.download.name}</a> 
            (<a href="${HOME_URLS.api.download.url}" download="${HOME_URLS.api.download.file}">${HOME_URLS.api.download.action}</a>)
        </li>
        <ol>
            <li>[v1] ${HOME_URLS.api.download.versions.name.v1}: <a href="${HOME_URLS.api.download.versions.url.v1}">${HOME_URLS.api.download.versions.url.v1}</a>
                (<a href="${HOME_URLS.api.download.versions.url.v1}" download="${HOME_URLS.api.download.versions.file.v1}">${HOME_URLS.api.download.action}</a>)
            </li>
        </ol>
        <li><a href="${HOME_URLS.website.url}">${HOME_URLS.website.name}</a></li>
        <li><a href="${HOME_URLS.apps.github.url}">${HOME_URLS.apps.github.name}</a></li>
      </ul>
    </body>
</html>`;

// Home Page Routes
export const ROOT_PATHS = [
	"/",
	"/home",
	"/root",
	"/start",
	"/info",
	"/about",
	"/links",
];
export const ROOT_ROUTES = new Elysia();
for (const path of ROOT_PATHS) {
	ROOT_ROUTES.get(path, () => ROOT);
}
export const API_FORWARD_ROUTES = new Elysia({ prefix: "" });
for (const path of API_PATHS) {
	API_FORWARD_ROUTES.get(path, ({ redirect }) => {
		return redirect(`/${path}/${SWAGGER_PATH}`);
	});
}
