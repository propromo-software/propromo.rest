import type { Context } from "elysia";
import { MicroserviceError } from "../../error";
import { isValidEnumArray } from "../../parse";

/**
 * Parses the input scopes and returns an array of valid enum values.
 *
 * @param {string} inputScopes - The input scopes to parse.
 * @param {object} validationEnum - The enum object to validate against.
 * @param {Context["set"]} set - The set object from the context.
 * @param {string[]} fallbackScopes - The fallback scopes to use if inputScopes is undefined or empty.
 * @param {string} [errorMessage] - The error message to throw if the scope values are invalid.
 * @return {T[]} An array of valid enum values.
 */
export function parseScopes<T>(
	inputScopes: string | undefined,
	validationEnum: object,
	set: Context["set"],
	fallbackScopes: string[] = ["open", "closed"],
	errorMessage?: string,
): T[] {
	const scope_values =
		inputScopes === undefined || inputScopes === ""
			? fallbackScopes
			: inputScopes.split(",");
	const scope_values_are_of_valid_enum_type = isValidEnumArray(
		scope_values,
		Object.values(validationEnum),
	);

	if (!scope_values_are_of_valid_enum_type) {
		set.status = 400;

		const message = errorMessage ?? "Invalid scope values";
		throw new MicroserviceError({ error: message, code: 400 });
	}

	return scope_values as T[];
}
