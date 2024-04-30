export const PORT = process?.env?.PORT ?? 3000;
export const DEV_MODE = process?.env?.DEV_MODE === "true";
export const JWT_SECRET = process?.env?.JWT_SECRET!;

export const DATABASE_URL = process?.env?.DATABASE_URL!;

/* GITHUB USER - OPEN SOURCE PROJECTS */
export const GITHUB_PAT = process?.env?.GITHUB_PAT?.trim()?.split(";"); // Array of GitHub Personal Access Tokens (PATs) (PAT;PAT;PAT...)

/* GITHUB APP */
export const GITHUB_APP_ID = process?.env?.GITHUB_APP_ID as string;
export const GITHUB_APP_PRIVATE_KEY = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY as string, 'utf-8').toString("utf-8");
export const GITHUB_APP_CLIENT_ID = process?.env?.GITHUB_APP_CLIENT_ID as string;
export const GITHUB_APP_CLIENT_SECRET = process?.env?.GITHUB_APP_CLIENT_SECRET as string;
export const GITHUB_APP_WEBHOOK_SECRET = process?.env?.GITHUB_APP_WEBHOOK_SECRET as string;
