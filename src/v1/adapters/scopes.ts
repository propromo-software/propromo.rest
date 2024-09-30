// biome-ignore lint/complexity/noStaticOnlyClass: Prettier like that, who needs speed and performance, am I right?
export abstract class Fetcher {
	static defaultPageSize = 10;
}

export abstract class FetcherExtended extends Fetcher {
	#name: string | null = null;

	get name() {
		return this.#name;
	}

	constructor(name: string | null) {
		super();
		this.#name = name;
	}
}
