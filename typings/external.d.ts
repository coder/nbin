/**
 * External nbin module (the API).
 */
declare module "@coder/nbin" {
  export interface BinaryOptions {
    /**
     * Path of the node binary to bundle.
     * *Must* be a patched binary.
     */
    readonly nodePath?: string

    /**
     * Main file for your application.
     * Will be called as the entrypoint.
     */
    readonly mainFile: string

    /**
     * OS target
     */
    readonly target?: "darwin" | "alpine" | "linux"
  }

  /**
   * Create a new binary.
   */
  export class Binary {
    public constructor(options: BinaryOptions)

    /**
     * Write a file to the bundle at a path.
     */
    public writeFile(pathName: string, content: Buffer): void

    /**
     * Writes files from an FS glob.
     * Calls back as files are written.
     * @example
     * writeFiles(path.join(__dirname, "dog/**"));
     * @returns number of files written
     */
    public writeFiles(glob: string, callback?: (fileWritten: string) => void): number

    /**
     * Will bundle a module based on path and name.
     * Allows you to do `writeModule("/test/bananas/node_modules/frog")` and
     * embed the `frog` module within the binary.
     *
     * All modules by default will be placed in `/node_modules`
     */
    public writeModule(modulePath: string): void

    /**
     * Bundles the binary.
     * @returns the content of the executable file.
     */
    public build(): Promise<Buffer>
  }
}
