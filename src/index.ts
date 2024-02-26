import { Elysia } from "elysia"; // https://elysiajs.com/introduction.html
import { cors } from '@elysiajs/cors'; // https://elysiajs.com/plugins/cors.html
import { html } from '@elysiajs/html'; // https://elysiajs.com/plugins/html.html
import { staticPlugin } from '@elysiajs/static'; // https://github.com/elysiajs/elysia-static
import { CORS_ORIGINS, LATEST_MAJOR_VERSION, LATEST_SWAGGER_PATH, ROOT_ROUTES, SWAGGER_PATH } from "./config";
import { V1 } from "./v1";

const app = new Elysia()
  .use(staticPlugin({
    assets: "static",
    prefix: "/"
  }))
  .use(cors({
    origin: CORS_ORIGINS
  }))
  .use(html())
  .use(ROOT_ROUTES)
  // VERSIONS
  .group(SWAGGER_PATH, (app) => app // if no version is specified, redirect to the latest version
    .get('', async ({ set }) => {
      set.status = 308;
      set.redirect = LATEST_SWAGGER_PATH;
    })
    .get('/json', async ({ set }) => {
      set.redirect = "/" + LATEST_SWAGGER_PATH + '/json';
    })
  )
  .use(V1)
  .listen(process.env.PORT || 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
