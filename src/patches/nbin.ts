import * as fs from "fs"
import * as nbin from "nbin"
import { readString } from "../common/buffer"
import { ReadableFilesystem } from "../common/filesystem"
import { readFooter } from "../common/footer"
import { fillFs } from "./fs"

const execPath = process.execPath
const execPathStat = fs.statSync(execPath)
const nbinFd = fs.openSync(execPath, "r")

// Footer is located at the end of the file.
const footer = readFooter(nbinFd, execPathStat.size)

// Contains the version, mainFile and the filesystem.
const headerBuffer = Buffer.allocUnsafe(footer.headerLength)
fs.readSync(nbinFd, headerBuffer, 0, footer.headerLength, footer.headerOffset)
const version = readString(headerBuffer, 0)
const mainFile = readString(headerBuffer, version.offset)

// Maximize read performance by using the originals before any overrides.
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

const exported: typeof nbin = {
  version: version.value,
  mainFile: mainFile.value,
  fs: readableFs,
  shimNativeFs: (path: string): void => {
    fillFs(path, readableFs)
  },
}

export = exported
