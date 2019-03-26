import * as fs from "fs";

export interface Footer {
	readonly headerLength: number;
	readonly headerOffset: number;
	readonly contentLength: number;
	readonly contentOffset: number;
}

/**
 * Reads a footer from a file descriptor with the size of the file
 */
export const readFooter = (fd: number, size: number): Footer => {
	const buffer = Buffer.allocUnsafe(16);
	fs.readSync(fd, buffer, 0, 16, size - 16);
	const headerLength = buffer.readUInt32BE(0);
	const headerOffset = buffer.readUInt32BE(4);
	const contentLength = buffer.readUInt32BE(8);
	const contentOffset = buffer.readUInt32BE(12);

	return {
		headerLength,
		headerOffset,
		contentLength,
		contentOffset,
	};
};

/**
 * Creates a footer defining byte lengths and offsets
 */
export const createFooter = (headerLength: number, headerOffset: number, contentLength: number, contentOffset: number): Buffer => {
	const buffer = Buffer.allocUnsafe(16);
	buffer.writeUInt32BE(headerLength, 0);
	buffer.writeUInt32BE(headerOffset, 4);
	buffer.writeUInt32BE(contentLength, 8);
	buffer.writeUInt32BE(contentOffset, 12);
	return buffer;
};