import { Elysia } from "elysia"; // https://elysiajs.com/introduction.html
import { cors } from '@elysiajs/cors'; // https://elysiajs.com/plugins/cors.html
import { html } from '@elysiajs/html'; // https://elysiajs.com/plugins/html.html
import { staticPlugin } from '@elysiajs/static'; // https://github.com/elysiajs/elysia-static
import { type InferContext, logger } from '@bogeychan/elysia-logger'; // https://www.npmjs.com/package/@bogeychan/elysia-logger

import { CORS_ORIGINS, LATEST_SWAGGER_PATH, ROOT_ROUTES, SWAGGER_PATH } from "./config";
import { V0 } from "./v0";
import { v1 } from "./v1";

const app: Elysia = new Elysia()
  .use(staticPlugin({ // serve static files from the "static" directory
    assets: "static",
    prefix: "/"
  }))
  .use(cors({
    origin: CORS_ORIGINS
  }))
  .use(
    logger({
      level: 'error',
      /**
       * This function will be invoked for each `log`-method called with `context`
       * where you can pass additional properties that need to be logged
       */
      customProps(ctx: InferContext<typeof app>) {
        return {
          params: ctx.params,
          query: ctx.query
        };
      }
    })
  )
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
    }, {
      detail: {
        description: "No authentication required. Redirects to the latest version of the API documentation in JSON format.",
        tags: ['documentation', 'json']
      }
    })
  )
  .use(V0)
  .use(v1)

  .listen(process.env.PORT || 3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
