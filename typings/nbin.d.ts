declare module 'nbin' {
	/**
	 * Returns the stat for a path.
	 */
	export interface Stat {
		readonly isDirectory: boolean;
		readonly isFile: boolean;
		readonly size: number;
	}

	export interface Disposable {
		dispose(): void;
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
	 * Reads a directory within the binary.
	 */
	export const readdirSync: (path: string) => ReadonlyArray<string>;

	/**
	 * Reads a file asynchronously from the binary.
	 */
	function readFile(path: string, encoding?: "buffer", offset?: number, length?: number): Promise<Buffer>;
	function readFile(path: string, encoding?: "utf8", offset?: number, length?: number): Promise<Buffer>;

	/**
	 * Reads a file synchronously from the binary.
	 */
	function readFileSync(path: string, encoding?: "buffer", offset?: number, length?: number): Buffer;
	function readFileSync(path: string, encoding?: "utf8", offset?: number, length?: number): Buffer;

	/**
	 * Uniquely generated ID for the packaged binary.
	 */
	export const id: string;

	/**
	 * Returns the entrypoint of the application.
	 */
	export const mainFile: string;

	/**
	 * Shims the native `fs` module for the path
	 */
	export const shimNativeFs: (path: string) => void;
}

declare module '@coder/nbin' {
	export interface BinaryOptions {
		/**
		 * Path of the node binary to bundle.
		 * *Must* be a patched binary.
		 */
		readonly nodePath?: string;

		/**
		 * Suppresses log output.
		 */
		readonly suppressOutput?: boolean;

		/**
		 * Main file for your application.
		 * Will be called as the entrypoint.
		 */
		readonly mainFile: string;

		/**
		 * OS target
		 */
		readonly target?: "darwin" | "alpine" | "linux";

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
		 * Calls back as files are written.
		 * @example
		 * writeFiles(path.join(__dirname, "dog/**"));
		 * @returns number of files written
		 */
		public writeFiles(glob: string, callback?: (fileWritten: string) => void): number;

		/**
		 * Will bundle a module based on path and name.
		 * Allows you to do `writeModule("/test/bananas/node_modules/frog")` and
		 * embed the `frog` module within the binary.
		 *
		 * All modules by default will be placed in `/node_modules`
		 */
		public writeModule(modulePath: string): void;

		/**
		 * Bundles the binary.
		 * @returns the content of the executable file.
		 */
		public build(): Promise<Buffer>;
	}
}
