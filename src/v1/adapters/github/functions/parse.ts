import type { Context } from "elysia";
import { MicroserviceError } from "../error";

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

/**
 * Checks if all elements in the array are valid enum values.
 *
 * @param {string[]} array - the array to be checked
 * @param {string[]} enumValues - the valid enum values
 * @return {boolean} true if all elements in the array are valid enum values, false otherwise
 */
export function isValidEnumArray(
	array: string[],
	enumValues: string[],
): boolean {
	for (let i = 0; i < array.length; i++) {
		if (!enumValues.includes(array[i])) {
			return false;
		}
	}
	return true;
}

/**
 * Converts a string or number input to a string or number output.
 * If the input is a string representation of a number, it is converted to a number.
 * If the input is already a number, it is returned as is.
 * If the input is not a valid number, the input is returned as is.
 *
 * @param {string | number} input - The input value to be converted.
 * @return {string | number} - The converted value.
 */
export function maybeStringToNumber(
	input: string | number | undefined,
): string | number {
	if (!input) return -1;
	const maybeNumber = +input; // like Number() - if it is a number, give me a number, if it is not, give me NaN, parseInt() stops at the first non numeric value and returns the number => weird :)

	if (!Number.isNaN(maybeNumber)) return maybeNumber;
	return input;
}
