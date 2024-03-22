import type { Context } from "elysia";
import type { PageSize } from "../types";

/**
 * Parses the input scopes and validates them against the provided enum, then returns the parsed scopes or an error object.
 *
 * @param {string} inputScopes - the input scopes to be parsed
 * @param {object} validationEnum - the enum object used for validation
 * @param {Context["set"]} set - the context set object
 * @param {string} errorMessage - the error message to be returned if validation fails
 * @return {T[] | { success: boolean, error: string }} the parsed scopes or an error object
 */
export function parseScopes<T>(inputScopes: string, validationEnum: object, set: Context["set"], errorMessage?: string): T[] | { success: boolean, error: string } {
    const scope_values = (inputScopes === undefined || inputScopes === "") ? ["essential"] : inputScopes.split(',');
    const scope_values_are_of_valid_enum_type = isValidEnumArray(scope_values, Object.values(validationEnum));

    if (!scope_values_are_of_valid_enum_type) {
        set.status = 400;
        return { success: false, error: errorMessage ?? 'Invalid scope values' };
    }

    return scope_values as T[];
}

export function parsePageSizes<T>(inputPageSizes: string, inputScopes: T[], set: Context["set"], errorMessage?: string): PageSize<T>[] | { success: boolean, error: string } {
    // inputPageSizes format: scopeName:pageSize,scopeName:pageSize

    if (inputPageSizes === undefined || inputPageSizes === "") {
        set.status = 400;
        return { success: false, error: errorMessage ?? 'Invalid page sizes.' };
    }

    const pageSizes = inputPageSizes.split(',').map((size) => {
        const [scopeName, pageSize] = size.split(':');
        return { scopeName, pageSize: Number(pageSize) } as { scopeName: T, pageSize: number };
    });

    function isValidPageSize(pageSize: number): boolean {
        return typeof pageSize === 'number' && !Number.isNaN(pageSize) && pageSize > 0 && pageSize <= 100;
    }

    function areValidPageSizes(pageSizes: { scopeName: T, pageSize: number }[]): boolean {
        return pageSizes.every(({ scopeName, pageSize }) => {
            return inputScopes.includes(scopeName) && isValidPageSize(pageSize);
        });
    }

    if (!areValidPageSizes(pageSizes)) {
        set.status = 400;
        return { success: false, error: errorMessage ?? 'Invalid page sizes.' };
    }

    return pageSizes;
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

/**
 * Validates the view parameter and returns a number.
 *
 * @param {string | undefined} view_string - the view parameter to validate
 * @return {number} the validated view parameter as a number, or -1 if invalid
 */
export function validateViewParameter(view_string: string | undefined): number {
    if (view_string === undefined) return -1;
    if (view_string === "%7Bproject_view%7D") return -1;
    const view = Number(view_string);
    if (Number.isNaN(view)) return -1;

    return view;
}
