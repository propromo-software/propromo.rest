export const PORT = process?.env?.PORT ?? 3000;
export const DEV_MODE = process?.env?.DEV_MODE === "true";
export const JWT_SECRET = String(process?.env?.JWT_SECRET);
export const PAT_SALT = String(process?.env?.PAT_SALT);
export const OPEN_SOURCE_PROGRAM_PATS = process?.env?.OPEN_SOURCE_PROGRAM_PATS
	? process.env.OPEN_SOURCE_PROGRAM_PATS.trim()?.split(";")
	: []; // Array of GitHub Personal Access Tokens (PATs) (PAT;PAT;PAT...)

export const DATABASE_MAIN_HOST =
	process?.env?.DATABASE_MAIN_HOST ?? "http://localhost:5432";
export const DATABASE_NEXT_HOST =
	process?.env?.DATABASE_NEXT_HOST ?? "http://localhost:5432";

/* GITHUB USER - OPEN SOURCE PROJECTS */
export const GITHUB_PAT = process?.env?.GITHUB_PAT?.trim()?.split(";"); // Array of GitHub Personal Access Tokens (PATs) (PAT;PAT;PAT...)

/* GITHUB APP */
export const GITHUB_APP_ID = process?.env?.GITHUB_APP_ID as string;
export const GITHUB_APP_PRIVATE_KEY = Buffer.from(
	process.env.GITHUB_APP_PRIVATE_KEY as string,
	"utf-8",
).toString("utf-8");
export const GITHUB_APP_CLIENT_ID = process?.env
	?.GITHUB_APP_CLIENT_ID as string;
export const GITHUB_APP_CLIENT_SECRET = process?.env
	?.GITHUB_APP_CLIENT_SECRET as string;
export const GITHUB_APP_WEBHOOK_SECRET = process?.env
	?.GITHUB_APP_WEBHOOK_SECRET as string;
