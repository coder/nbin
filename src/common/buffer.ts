/**
 * Write a string to a buffer.
 */
export const writeString = (buffer: Buffer, value: string, offset = 0): number => {
  const len = Buffer.byteLength(value)
  buffer.writeUInt16BE(len, offset)
  offset += 2
  offset += buffer.write(value, offset, "utf8")
  return offset
}

/**
 * Read a string from a buffer.
 */
export const readString = (
  buffer: Buffer,
  offset: number
): {
  readonly value: string
  readonly offset: number
} => {
  const len = buffer.readUInt16BE(offset)
  offset += 2
  const value = buffer.slice(offset, offset + len).toString("utf8")
  offset += len
  return {
    offset,
    value,
  }
}
