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
