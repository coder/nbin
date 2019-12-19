import * as fs from "fs"

/**
 * Internal nbin module. Only available inside the binary.
 */
declare module "nbin" {
  /**
   * Returns the stat for a path.
   */
  export interface Stat {
    readonly isDirectory: boolean
    readonly isFile: boolean
    readonly size: number
  }

  export interface Filesystem {
    /**
     * Checks if a file exists within the binary.
     */
    existsSync(path: fs.PathLike): boolean

    /**
     * Performs a stat on paths within the binary.
     */
    statSync(path: fs.PathLike): Stat

    /**
     * Reads a directory within the binary.
     */
    readdirSync(path: fs.PathLike): ReadonlyArray<string>

    /**
     * Reads a file asynchronously from the binary.
     */
    readFile(path: fs.PathLike, encoding?: "buffer", offset?: number, length?: number): Promise<Buffer>
    readFile(path: fs.PathLike, encoding?: "utf8", offset?: number, length?: number): Promise<string>

    /**
     * Reads a file synchronously from the binary.
     */
    readFileSync(path: fs.PathLike, encoding?: "buffer", offset?: number, length?: number): Buffer
    readFileSync(path: fs.PathLike, encoding?: "utf8", offset?: number, length?: number): string
  }

  /**
   * nbin version.
   */
  export const version: string

  /**
   * Returns the entrypoint of the application.
   */
  export const mainFile: string

  /**
   * Shims the native `fs` module for the path.
   */
  export const shimNativeFs: (path: string) => void

  /**
   * Provides file system access into the binary.
   */
  export const fs: Filesystem

  /**
   * Where to extract temporary files.
   */
  export const tmpDir: string
}
