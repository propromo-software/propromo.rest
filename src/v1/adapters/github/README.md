# Propromos Github Adapter for the needed Github Graphql-API-Endpoints

Some endpoints of the Github-API can only be accessed via the Graphql-API.  
This adapter provides a simple way to access the endpoints that the Propromo-App needs via rest.  
It is basically a wrapper around the Github Graphql-API, to reduce it's complexity and to make it easier to use.

Not included is data, that should not be accessible by a monitor viewer like **collaborators**, **mentionableUsers** and so on.  
Users are not allowed to see the people working on a project, so that only the scrum-master is talking to the product owner via chat. (it would require the token to have write access)

## Docs

[/v1/api#tag/github](http://localhost:3000/v1/api#tag/github)

## Testing

| URL                                                  | Description      | Parameters |
| ---------------------------------------------------- | ---------------- | ---------- |
| <http://localhost:3000/v1/github/info/quota/graphql> | View quota left. | none       |
