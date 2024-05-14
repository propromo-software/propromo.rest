# INFO

## Kubernetes

<https://kubernetes.io/docs/reference/kubectl/quick-reference/>

`kubectl get pods`

## Deploy

`kubectl apply -f propromo.rest-k8s-cluster.yml`

### Logs

`kubectl logs <podname> -c <init-container-name>`

## Secrets

`kubectl create secret generic propromo-rest-secret --from-env-file=.env`
