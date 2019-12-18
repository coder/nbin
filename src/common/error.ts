export const createNotFound = (): NodeJS.ErrnoException => {
  const e = new Error("File not found")
  Object.defineProperty(e, "code", { value: "ENOENT" })
  return e
}
