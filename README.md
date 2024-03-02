# Propromo rest microservice

# Deployments

https://rest-microservice.onrender.com

## Status

https://propromo.openstatus.dev

## Development

To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

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
