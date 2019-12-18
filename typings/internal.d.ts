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

  /**
   * Checks if a file exists within the binary.
   */
  export const existsSync: (path: fs.PathLike) => boolean

  /**
   * Performs a stat on paths within the binary.
   */
  export const statSync: (path: fs.PathLike) => Stat

  /**
   * Reads a directory within the binary.
   */
  export const readdirSync: (path: fs.PathLike) => ReadonlyArray<string>

  /**
   * Reads a file asynchronously from the binary.
   */
  function readFile(path: fs.PathLike, encoding?: "buffer", offset?: number, length?: number): Promise<Buffer>
  function readFile(path: fs.PathLike, encoding?: "utf8", offset?: number, length?: number): Promise<string>

  /**
   * Reads a file synchronously from the binary.
   */
  function readFileSync(path: fs.PathLike, encoding?: "buffer", offset?: number, length?: number): Buffer
  function readFileSync(path: fs.PathLike, encoding?: "utf8", offset?: number, length?: number): string

  /**
   * nbin version.
   */
  export const version: string

  /**
   * Returns the entrypoint of the application.
   */
  export const mainFile: string

  /**
   * Shims the native `fs` module for the path
   */
  export const shimNativeFs: (path: string) => void
}
