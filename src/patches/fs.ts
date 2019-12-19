/**
 * A patch for `fs` permitting certain directories to be routed within the
 * binary.
 */
import * as fs from "fs"
import * as nbin from "nbin"
import * as path from "path"
import * as util from "util"
import { createNotFound } from "../common/error"

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

interface OpenFile {
  readonly path: fs.PathLike
  readLocation: number
}

/**
 * Fills `${pathName}/*` with the binary stuff.
 */
export const fillFs = (pathName: string, filesystem: nbin.Filesystem): void => {
  const openFiles = new Map<number, OpenFile>()
  const override = <T extends keyof typeof fs>(
    propertyName: T,
    factory: (callOld: () => any) => Omit<typeof fs[T], "__promisify__" | "native">,
    customPromisify?: (...args: any[]) => Promise<any>
  ): void => {
    const oldfunc = (fs as any)[propertyName]
    ;(fs as any)[propertyName] = (...args: any[]): any => {
      const callOld = (): any => (oldfunc as any)(...args)

      // Try to determine whether this call falls within the path we are trying
      // to fill. If it doesn't we'll call the original method.
      let realPath = args[0]
      // Likely a file descriptor
      if (typeof realPath === "number") {
        const newFd = args[0]
        const maybeRealPath = openFiles.get(newFd)
        if (maybeRealPath) {
          realPath = maybeRealPath
        }
        // Likely a file path.
      } else if (typeof realPath === "string") {
        const newPath = realPath
        const rel = path.relative(pathName, newPath!)
        if (!rel.startsWith("..")) {
          // Looks like it falls within the fill path.
          return (factory(callOld) as any)(...args)
        }
      }

      return callOld()
    }

    if (customPromisify) {
      ;(fs as any)[propertyName][util.promisify.custom] = customPromisify
    }
  }

  let fdId = 0
  const findCb = (args: any[]): undefined | ((...args: any[]) => void) => {
    const cb = args.filter((d) => {
      return typeof d === "function"
    })
    if (cb.length === 0) {
      return
    }
    return cb[0]
  }

  override("access", (callOld) => (pathName: fs.PathLike): void => {
    if (!filesystem.existsSync(pathName)) {
      return callOld()
    }
  })

  override("accessSync", (callOld) => (pathName: fs.PathLike): void => {
    if (!filesystem.existsSync(pathName)) {
      return callOld()
    }
  })

  override("close", (callOld) => (fd: number, callback: Function): void => {
    if (!openFiles.has(fd)) {
      return callOld()
    }

    openFiles.delete(fd)
    callback(null)
  })

  override("closeSync", (callOld) => (fd: number): void => {
    if (!openFiles.has(fd)) {
      return callOld()
    }

    openFiles.delete(fd)
  })

  override(
    "exists",
    () => (pathName: fs.PathLike, callback: Function): void => {
      callback(filesystem.existsSync(pathName))
    },
    (pathName: fs.PathLike): Promise<boolean> => {
      return new Promise((resolve) => {
        return fs.exists(pathName, (exists) => {
          resolve(exists)
        })
      })
    }
  )

  override("existsSync", () => (pathName: fs.PathLike): boolean => {
    return filesystem.existsSync(pathName)
  })

  override(
    "fstat",
    (callOld) => (fd: number, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void): void => {
      if (!openFiles.has(fd)) {
        return callOld()
      }

      const openFile = openFiles.get(fd)
      if (!openFile) {
        return callback(createNotFound(), null!)
      }
      return fs.stat(openFile.path, callback)
    }
  )

  override("fstatSync", (callOld) => (fd: number): fs.Stats => {
    if (!openFiles.has(fd)) {
      return callOld()
    }

    const openFile = openFiles.get(fd)
    if (!openFile) {
      throw createNotFound()
    }
    return fs.statSync(openFile.path)
  })

  override(
    "lstat",
    () => (pathName: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats) => void): void => {
      return fs.stat(pathName, callback)
    }
  )

  override("lstatSync", () => (pathName: fs.PathLike): fs.Stats => {
    return fs.statSync(pathName)
  })

  const doOpen = (pathName: fs.PathLike): number => {
    const desc = fdId++
    openFiles.set(desc, {
      path: pathName,
      readLocation: 0,
    })
    return desc
  }

  override("open", (callOld) => (pathName: fs.PathLike, ...args: any[]): void => {
    if (!filesystem.existsSync(pathName)) {
      return callOld()
    }
    const fd = doOpen(pathName)
    const cb = findCb(args)
    if (!cb) {
      return
    }
    process.nextTick(() => {
      cb(null, fd)
    })
  })

  override("openSync", (callOld) => (pathName: fs.PathLike): number => {
    if (!filesystem.existsSync(pathName)) {
      return callOld()
    }
    return doOpen(pathName)
  })

  override(
    "read",
    (callOld) => (
      fd: number,
      buffer: Buffer,
      offset: number,
      length: number,
      position: number,
      callback: Function
    ): void => {
      const openFile = openFiles.get(fd)
      if (!openFile) {
        return callOld()
      }

      let hadPosition = true
      if (typeof position === "undefined" || position === null) {
        position = openFile.readLocation
        hadPosition = false
      }
      filesystem
        .readFile(openFile.path, "buffer", position, length)
        .then((content) => {
          buffer.set(content, offset)
          if (!hadPosition) {
            openFile.readLocation += content.byteLength
          }
          // tslint:disable-next-line:no-any
          callback(null, content.byteLength, content as any)
        })
        .catch((ex) => {
          callback(ex, null, null)
        })
    },
    (fd, buffer: Buffer, offset, length, position) => {
      return new Promise((resolve, reject) => {
        return fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
          if (err) {
            return reject(err)
          }

          resolve({
            bytesRead,
            buffer,
          })
        })
      })
    }
  )

  override(
    "readSync",
    (callOld) => (fd: number, buffer: Buffer, offset: number, length: number, position: number): number => {
      const openFile = openFiles.get(fd)
      if (!openFile) {
        return callOld()
      }

      let hadPosition = true
      if (typeof position === "undefined" || position === null) {
        position = openFile.readLocation
        hadPosition = false
      }
      const content = filesystem.readFileSync(openFile.path, "buffer", position, length)
      buffer.set(content, offset)
      if (!hadPosition) {
        openFile.readLocation += content.byteLength
      }
      return content.byteLength
    }
  )

  override("readdir", () => (pathName: fs.PathLike, ...args: any[]): void => {
    const cb = findCb(args)
    if (!cb) {
      return
    }
    cb(null, filesystem.readdirSync(pathName))
  })

  override("readdirSync", () => (pathName: string): string[] => {
    return [...filesystem.readdirSync(pathName)]
  })

  override("readFile", () => (pathName: string, ...args: any[]): void => {
    let encoding = "buffer"
    if (typeof args[0] === "string") {
      encoding = args[0]
    }
    if (typeof args[0] === "object" && args[0] !== null) {
      const opts = args[0]
      if (opts.encoding) {
        encoding = opts.encoding
      }
    }
    const cb = findCb(args)
    if (!cb) {
      return
    }
    filesystem
      .readFile(pathName, encoding as "utf8")
      .then((result) => {
        cb(null, result)
      })
      .catch((ex) => {
        cb(ex)
      })
  })

  override("readFileSync", () => (pathName: string, ...args: any[]): string | Buffer => {
    let encoding = "buffer"
    if (typeof args[0] === "string") {
      encoding = args[0]
    }
    if (typeof args[0] === "object" && args[0] !== null) {
      const opts = args[0]
      if (opts.encoding) {
        encoding = opts.encoding
      }
    }
    return filesystem.readFileSync(pathName, encoding as "buffer")
  })

  override("realpath", () => (pathName: fs.PathLike, ...args: any[]): void => {
    const cb = findCb(args)
    if (!cb) {
      return
    }
    cb(null, pathName)
  })

  override("realpathSync", () => (pathName: fs.PathLike): fs.PathLike => {
    return pathName
  })

  const doStat = (pathName: fs.PathLike): fs.Stats => {
    const stat = filesystem.statSync(pathName)
    const date = new Date()

    return new (class {
      isBlockDevice(): false {
        return false
      }
      isCharacterDevice(): false {
        return false
      }
      isDirectory(): boolean {
        return stat.isDirectory
      }
      isFIFO(): false {
        return false
      }
      isFile(): boolean {
        return stat.isFile
      }
      isSocket(): false {
        return false
      }
      isSymbolicLink(): false {
        return false
      }

      public readonly atime = date
      public readonly atimeMs = date.getTime()
      public readonly birthtime = date
      public readonly birthtimeMs = date.getTime()
      public readonly blksize = null!
      public readonly blocks = null!
      public readonly ctime = date
      public readonly ctimeMs = date.getTime()
      public readonly dev = null!
      public readonly gid = 0
      public readonly ino = 0
      public readonly mode = null!
      public readonly mtime = date
      public readonly mtimeMs = date.getTime()
      public readonly nlink = null!
      public readonly rdev = null!
      public readonly size = stat.size
      public readonly uid = 0
    })()
  }

  override("stat", () => (pathName: fs.PathLike, ...args: any[]): void => {
    const cb = findCb(args)
    if (!cb) {
      return
    }
    cb(null, doStat(pathName))
  })

  override("statSync", () => (pathName: fs.PathLike): fs.Stats => {
    return doStat(pathName)
  })
}
