import { Context } from "elysia";
import { GITHUB_MILESTONES_DEPTH, GITHUB_MILESTONE_ISSUE_STATES, GITHUB_REPOSITORY_SCOPES } from "../types";

/**
 * Parses and validates the milestone depth and issue states from the given strings and sets the response status in the context.
 *
 * @param {string} depth_as_string - the string containing milestone depth values
 * @param {string} issueStates_as_string - the string containing issue states values
 * @param {Context["set"]} set - the context set object
 * @return {{ depth: GITHUB_MILESTONES_DEPTH[], issue_states: GITHUB_MILESTONE_ISSUE_STATES[] } | { success: boolean, error: string }} the parsed milestone depth and issue states or an error object
 */
export function parseMilestoneDepthAndIssueStates(depth_as_string: string, issueStates_as_string: string, set: Context["set"]): { depth: GITHUB_MILESTONES_DEPTH[], issue_states: GITHUB_MILESTONE_ISSUE_STATES[] } | { success: boolean, error: string } {
    const depth_values = depth_as_string.split(',');
    const depth_values_are_of_valid_enum_type = isValidEnumArray(depth_values, Object.values(GITHUB_MILESTONES_DEPTH));
    const issue_states_values = issueStates_as_string.split(',');
    const issue_states_values_are_of_valid_enum_type = isValidEnumArray(issue_states_values, Object.values(GITHUB_MILESTONE_ISSUE_STATES));

    if (!depth_values_are_of_valid_enum_type) {
        set.status = 400;
        return { success: false, error: 'Invalid `depth` values' };
    }

    if (!issue_states_values_are_of_valid_enum_type) {
        set.status = 400;
        return { success: false, error: 'Invalid `issue_states` values' };
    }

    const depth = depth_values as GITHUB_MILESTONES_DEPTH[];
    const issue_states = issue_states_values as GITHUB_MILESTONE_ISSUE_STATES[];

    return {
        depth,
        issue_states
    };
}

/**
 * Parses the provided repository scopes string and returns an array of GITHUB_REPOSITORY_SCOPES if successful, 
 * or an object with the success status and error message if invalid scope values are provided.
 *
 * @param {string} repository_scopes_as_string - The string containing repository scope values
 * @param {Context["set"]} set - The set context object
 * @return {GITHUB_REPOSITORY_SCOPES[] | { success: boolean, error: string }} The parsed repository scopes array or an object with success and error message
 */
export function parseScopedRepositories(repository_scopes_as_string: string, set: Context["set"]): GITHUB_REPOSITORY_SCOPES[] | { success: boolean, error: string } {
    const scope_values = repository_scopes_as_string.split(',');
    const scope_values_are_of_valid_enum_type = isValidEnumArray(scope_values, Object.values(GITHUB_REPOSITORY_SCOPES));

    if (!scope_values_are_of_valid_enum_type) {
        set.status = 400;
        return { success: false, error: 'Invalid scope values' };
    }

    const scope = scope_values as GITHUB_REPOSITORY_SCOPES[];
    return scope;
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
