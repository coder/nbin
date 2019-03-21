declare module 'nbin' {
	/**
	 * Returns the stat for a path.
	 */
	export interface Stat {
		readonly isDirectory: boolean;
		readonly isFile: boolean;
	}

	/**
	 * Checks if a file exists within the binary.
	 */
	export const existsSync: (path: string) => boolean;

	/**
	 * Performs a stat on paths within the binary.
	 */
	export const statSync: (path: string) => Stat;

	/**
	 * Reads a file synchronously from the binary.
	 */
	export const readFileSync: ((path: string) => Buffer | undefined) | ((path: string, encoding: "utf8") => string | undefined);

	/**
	 * Returns the entrypoint of the application.
	 */
	export const mainFile: string;
}

declare module '@coder/nbin' {
	export interface BinaryOptions {
		/**
		 * Path of the node binary to bundle.
		 * *Must* be a patched binary.
		 */
		readonly nodePath?: string;

		/**
		 * Main file for your application.
		 * Will be called as the entrypoint.
		 */
		readonly mainFile: string;
	}

	/**
	 * Create a new binary.
	 */
	export class Binary {
		public constructor(
			options: BinaryOptions,
		);

		/**
		 * Write a file to the bundle at a path.
		 */
		public writeFile(pathName: string, content: Buffer): void;

		/**
		 * Writes files from an FS glob.
		 * @example
		 * writeFiles(path.join(__dirname, "dog/**"));
		 */
		public writeFiles(glob: string): number;

		/**
		 * Resolves a module using `require.resolve`. Bundles
		 * it into `/node_modules`. Natively node will fallback
		 * to that directory.
		 */
		public writeModule(moduleName: string): void;

		/**
		 * Bundles the binary.
		 * @returns the content of the executable file.
		 */
		public build(): Buffer;
	}
}
