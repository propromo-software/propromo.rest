import {
	ApolloClient,
	InMemoryCache,
	gql,
	HttpLink,
} from "@apollo/client/core"; // https://github.com/apollographql/apollo-client/issues/11351
import { setContext } from "@apollo/client/link/context";
import type { Context } from "elysia";
import { MicroserviceError } from "./error";
import { DEV_MODE } from "../../environment";

/**
 * Fetches data from a GraphQL endpoint using Basic Authentication.
 *
 * @param document The GraphQL query document.
 * @param endpoint The URL of the GraphQL endpoint.
 * @param user The email address to use for Basic Authentication.
 * @param secret The API token to use for Basic Authentication.
 * @param set The context set function.
 * @returns A promise that resolves to a GraphQL response.
 */
export async function fetchGraphqlEndpointUsingBasicAuth<T>(
	document: string,
	endpoint: string,
	{ user, secret }: { user: string; secret: string },
	set: Context["set"],
) {
	if (DEV_MODE) {
		console.log(
			`Fetching data from the GraphQL endpoint '${endpoint}' using Basic Authentication {${user}:${secret}}...`,
		);
	}

	const authLink = setContext((_, { headers }) => {
		const base64Token = Buffer.from(`${user}:${secret}`).toString("base64");

		return {
			headers: {
				...headers,
				Authorization: `Basic ${base64Token}`,
			},
		};
	});

	// Creates a link that combines the auth and HTTP link
	const host = `https://${endpoint}/gateway/api/graphql`;
	const httpLink = new HttpLink({ uri: host });
	const client = new ApolloClient({
		link: authLink.concat(httpLink),
		cache: new InMemoryCache(),
	});

	// Fetches data from the GraphQL endpoint
	return await client
		.query<T>({
			query: gql`${document}`,
		})
		.catch((error) => {
			const code = error.message.includes("401") ? 401 : 500;

			set.status = code;
			throw new MicroserviceError({
				error: `Failed to fetch data from the GraphQL endpoint '${endpoint}'.`,
				code: code,
			});
		})
		.finally(() => {
			client.stop();
		});
}
