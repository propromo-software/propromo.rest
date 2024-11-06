export const validateBasicAuthenticationInput = (input: string) => {
    const tokenParts = input.split(" ");
    const tokenAuth = tokenParts[1].split(":");
    const host = tokenParts[0];
    const user = tokenAuth[0];
    const secret = tokenAuth[1];

    return {
        host,
        user,
        secret,
    };
}
