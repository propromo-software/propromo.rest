import type { Context } from "elysia";

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
export function parseScopes<T>(inputScopes: string, validationEnum: object, set: Context["set"], fallbackScopes: string[], errorMessage?: string): T[] {
    const scope_values = (inputScopes === undefined || inputScopes === "") ? fallbackScopes : inputScopes.split(',');
    const scope_values_are_of_valid_enum_type = isValidEnumArray(scope_values, Object.values(validationEnum));

    if (!scope_values_are_of_valid_enum_type) {
        set.status = 400;
        throw Error(errorMessage ?? 'Invalid scope values');
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
export function isValidEnumArray(array: string[], enumValues: string[]): boolean {
    for (let i = 0; i < array.length; i++) {
        if (!enumValues.includes(array[i])) {
            return false;
        }
    }
    return true;
}
