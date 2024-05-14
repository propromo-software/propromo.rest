export interface MicroserviceErrorOptions {
	error: string;
	code?: number;
	success?: boolean;
	info?: object | null;
	data?: object | null;
}

export class MicroserviceError extends Error {
	json: MicroserviceErrorOptions;

	constructor(options: MicroserviceErrorOptions) {
		super(options.error);
		this.name = "MicroserviceError";
		this.json = options;
		this.json.code = typeof options.code === "number" ? options.code : 500; // Default to Internal Server Error if no status code is provided
		this.json.success = options?.success ? options.success : false; // so that you can always check the response status, even if it's an error
		this.json.info = options?.info ? options.info : null;
		this.json.data = options?.data ? options.data : null; // so that you can always check the response data, even if it's an error

		// Capturing stack trace, excluding constructor call from it.
		if (typeof Error.captureStackTrace === "function") {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	toJSON(): MicroserviceErrorOptions {
		return JSON.parse(JSON.stringify(this.json)); // so that functions and so on are being converted to json
	}

	toString(): string {
		return JSON.stringify(this.json);
	}
}
