import { Context } from "elysia";
import { MicroserviceError } from "./error";

/**
 * Check for the presence of a token and throw an error if it is missing.
 *
 * @param {string | undefined} token - The token to be checked
 * @param {Context["set"]} set - The set context
 * @param {string} errorMessage - The error message to be thrown if the token is missing
 * @return {string} The token as a string if it is present
 */
export function checkForTokenPresence(
	token: string | undefined,
	set: Context["set"],
	jwtRealm:
		| "propromoRestAdaptersGithub"
		| "propromoRestAdaptersJira" = "propromoRestAdaptersGithub",
	errorMessage: string = "Token is missing. Create one at https://github.com/settings/tokens.",
): string {
	if (!token || token.trim().length === 0) {
		// Authorization: Bearer <token>
		set.status = 400;
		set.headers["WWW-Authenticate"] =
			`Bearer realm='${jwtRealm}', error="bearer_token_missing"`;

		throw new MicroserviceError({ error: errorMessage, code: 400 });
	}

	return token;
}
