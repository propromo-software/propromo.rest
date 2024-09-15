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
