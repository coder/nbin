import * as fs from "fs";

export interface Footer {
	readonly byteLength: number;
	readonly byteOffset: number;
}

/**
 * Reads a footer from a file descriptor with the size of the file
 */
export const readFooter = (fd: number, size: number): Footer => {
	const buffer = Buffer.allocUnsafe(8);
	fs.readSync(fd, buffer, 0, 8, size - 8);
	const length = buffer.readUInt32BE(0);
	const offset = buffer.readUInt32BE(4);

	return {
		byteLength: length,
		byteOffset: offset,
	};
};

/**
 * Creates a footer defining byte lengths and offsets
 */
export const createFooter = (byteLength: number, byteOffset: number): Buffer => {
	const buffer = Buffer.allocUnsafe(8);
	buffer.writeUInt32BE(byteLength, 0);
	buffer.writeUInt32BE(byteOffset, 4);
	return buffer;
};