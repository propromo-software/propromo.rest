# Propromo rest microservice

## Deployments

<https://rest-microservice.onrender.com>

## Status

<https://propromo.openstatus.dev>

## Development

To start the development server run:

```bash
bun run dev
```

Open <http://localhost:3000/> with your browser to see the result.

### GitHub GraphQL-Explorer

The [Github GraphQL-Explorer](https://docs.github.com/en/graphql/overview/explorer) can only be used on the GitHub docs domain, because everything else is not in GitHub's CORS policy (docs.github.com).

The window is quite small. I recommend using a [Stylus](https://chromewebstore.google.com/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne) user-css to make it larger. ([example](https://gist.github.com/jonasfroeller/c1714de2d7fb162fdef94e3f83df9d0e)).  
Use a [diacritics remover](https://pteo.paranoiaworks.mobi/diacriticsremover), if you copied the graphql from somewhere else, before pasting it.

### Testing

[![cov](https://propromo-software.github.io/propromo.rest/coverage.svg)](https://github.com/propromo-software/propromo.rest/actions)

```bash
bun test
```

## Production

### Deployment

```bash
# build and push the image in . to heroku
heroku container:push web
```

```bash
# deploy the container to heroku using the pushed image
heroku container:release web
```

#### Environment variables

`process.env.<ENV_VAR_NAME>`
