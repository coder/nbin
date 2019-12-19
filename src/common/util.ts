import * as fs from "fs"
import * as os from "os"
import * as path from "path"

export const mkdirp = (p: string): void => {
  try {
    fs.mkdirSync(p)
  } catch (error) {
    if (error.code !== "EEXIST") {
      const parent = path.dirname(p)
      if (parent === p) {
        throw error
      }
      mkdirp(parent)
      fs.mkdirSync(p)
    }
  }
}

export const getXdgCacheHome = (name: string): string => {
  switch (process.platform) {
    case "win32":
      return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), "AppData/Local"), `${name}/Cache`)
    case "darwin":
      return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), "Library/Caches"), name)
    default:
      return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), name)
  }
}
