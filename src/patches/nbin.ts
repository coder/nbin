import * as fs from "fs"
import { Stat } from "nbin"
import * as path from "path"
import { readString } from "../common/buffer"
import { createNotFound } from "../common/error"
import { ReadableFilesystem } from "../common/filesystem"
import { readFooter } from "../common/footer"
import { fillFs } from "./fs"

const execPath = process.execPath
const execPathStat = fs.statSync(execPath)
const nbinFd = fs.openSync(execPath, "r")

// Footer is located at the end of the file
const footer = readFooter(nbinFd, execPathStat.size)

// Contains the version, mainFile and the filesystem
const headerBuffer = Buffer.allocUnsafe(footer.headerLength)
fs.readSync(nbinFd, headerBuffer, 0, footer.headerLength, footer.headerOffset)
const version = readString(headerBuffer, 0)
const mainFile = readString(headerBuffer, version.offset)

/**
 * Maximize read perf by storing before any overrides
 */
const originalRead = fs.read
const originalReadSync = fs.readSync

const fsBuffer = headerBuffer.slice(mainFile.offset)
const readableFs = ReadableFilesystem.fromBuffer(fsBuffer, {
  readContents: (offset: number, length: number): Promise<Buffer> => {
    const buffer = Buffer.allocUnsafe(length)
    return new Promise<Buffer>((resolve, reject) => {
      originalRead(nbinFd, buffer, 0, length, offset + footer.contentOffset, (err, _, buffer) => {
        if (err) {
          return reject(err)
        }

        resolve(buffer)
      })
    })
  },
  readContentsSync: (offset: number, length: number): Buffer => {
    const buffer = Buffer.alloc(length)
    originalReadSync(nbinFd, buffer, 0, length, offset + footer.contentOffset)
    return buffer
  },
})

/**
 * Parses an entry from a readable FS.
 * Will split the inputted path and attempt to
 * nest down the tree.
 */
const parse = (
  fullPath: string
):
  | {
      readonly fs: ReadableFilesystem
      readonly name: string
    }
  | undefined => {
  const parts = path
    .normalize(fullPath)
    .split(path.sep)
    .filter((i) => i.length)
  let filesystem = readableFs
  for (let i = 0; i < parts.length; i++) {
    if (!filesystem) {
      return undefined
    }
    const part = parts[i]
    if (i === parts.length - 1) {
      return {
        fs: filesystem,
        name: part,
      }
    } else {
      const maybeFilesystem = filesystem.cd(part)
      if (!maybeFilesystem) {
        return undefined
      }
      filesystem = maybeFilesystem
    }
  }
  return undefined
}

const exported: typeof import("nbin") = {
  version: version.value,
  mainFile: mainFile.value,

  existsSync: (pathName: string): boolean => {
    const stat = exported.statSync(pathName)
    return stat.isFile || stat.isDirectory
  },

  readdirSync: (pathName: string): ReadonlyArray<string> => {
    const res = parse(pathName)
    if (!res) {
      throw createNotFound()
    }
    const filesystem = res.fs.cd(res.name)
    if (!filesystem) {
      throw createNotFound()
    }
    return filesystem.ls()
  },

  readFile: async (pathName: string, encoding?: "utf8", offset?: number, length?: number): Promise<Buffer | string> => {
    const res = parse(pathName)
    if (!res) {
      throw createNotFound()
    }
    const b = await res.fs.read(res.name, offset, length)
    if (encoding && encoding === "utf8") {
      return b.toString()
    }
    return b
  },

  readFileSync: (pathName: string, encoding?: "utf8", offset?: number, length?: number): Buffer | string => {
    const res = parse(pathName)
    if (!res) {
      throw createNotFound()
    }
    const b = res.fs.readSync(res.name, offset, length)
    if (encoding && encoding === "utf8") {
      return b.toString()
    }
    return b
  },

  statSync: (pathName: string): Stat => {
    const res = parse(pathName)
    if (!res) {
      return {
        isDirectory: false,
        isFile: false,
        size: 0,
      }
    }
    return res.fs.stat(res.name)
  },

  shimNativeFs: (pathName: string): void => {
    fillFs(pathName)
  },
} as typeof import("nbin")

export = exported
