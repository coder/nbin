import { readString, writeString } from "./buffer";

interface Stat {
	readonly isFile: boolean;
	readonly isDirectory: boolean;
	readonly size: number;
}

interface File {
	readonly byteLength: number;
	readonly byteOffset: number;

	read(offset?: number, length?: number): Promise<Buffer>;
	readSync(offset?: number, length?: number): Buffer;
}

export abstract class Filesystem {
	protected readonly directories: Map<string, Filesystem> = new Map();
}

export interface ReadableFilesystemProvider {
	readContents: (offset: number, length: number) => Promise<Buffer>;
	readContentsSync: (offset: number, length: number) => Buffer;
}

export class ReadableFilesystem extends Filesystem {
	public static fromBuffer(buffer: Buffer, provider: ReadableFilesystemProvider): ReadableFilesystem {
		let offset = 0;
		const dirAmount = buffer.readUInt16BE(offset);
		offset += 2;
		const directory = new ReadableFilesystem();
		for (let i = 0; i < dirAmount; i++) {
			const dirName = readString(buffer, offset);
			offset = dirName.offset;
			const dirSliceLen = buffer.readUInt32BE(offset);
			offset += 4;
			directory.directories.set(dirName.value, ReadableFilesystem.fromBuffer(buffer.slice(offset, offset + dirSliceLen), provider));
			offset += dirSliceLen;
		}
		const fileAmount = buffer.readUInt16BE(offset);
		offset += 2;
		for (let i = 0; i < fileAmount; i++) {
			const fileName = readString(buffer, offset);
			offset = fileName.offset;
			const byteOffset = buffer.readUInt32BE(offset);
			offset += 4;
			const byteLength = buffer.readUInt32BE(offset);
			offset += 4;

			directory.files.set(fileName.value, {
				byteLength,
				byteOffset,

				read: (offset: number = 0, length: number = byteLength): Promise<Buffer> => {
					offset = Math.min(byteOffset + offset, byteOffset + byteLength);
					length = Math.min(length, byteLength, (byteOffset + byteLength) - offset);

					return provider.readContents(offset, length);
				},

				readSync: (offset: number = 0, length: number = byteLength): Buffer => {
					offset = Math.min(byteOffset + offset, byteOffset + byteLength);
					length = Math.min(length, byteLength, (byteOffset + byteLength) - offset);

					return provider.readContentsSync(offset, length);
				},
			});
		}
		return directory;
	}

	protected readonly files: Map<string, File> = new Map();

	public ls(): ReadonlyArray<string> {
		return [...Array.from(this.directories.keys()), ...Array.from(this.files.keys())];
	}

	public stat(name: string): Stat {
		const isFile = this.files.has(name);
		return {
			isFile: isFile,
			isDirectory: this.directories.has(name),
			size: isFile ? this.files.get(name).byteLength : 0,
		};
	}

	public cd(name: string): ReadableFilesystem | undefined {
		return this.directories.get(name) as ReadableFilesystem;
	}

	public read(name: string, offset?: number, length?: number): Promise<Buffer> {
		const file = this.files.get(name);
		if (!file) {
			return Promise.reject("File not found");
		}
		return file.read(offset, length);
	}

	public readSync(name: string, offset?: number, length?: number): Buffer {
		const file = this.files.get(name);
		if (!file) {
			throw new Error("File not found");
		}
		return file.readSync(offset, length);
	}
}

export class WritableFilesystem extends Filesystem {
	protected readonly files: Map<string, Buffer> = new Map();
	private readonly contentBuffers: Buffer[] = [];
	private contentLength: number = 0;

	public constructor(
		private readonly parent?: WritableFilesystem,
	) {
		super();
	}

	/**
	 * Write a file.
	 */
	public write(name: string, value: Buffer): void {
		this.files.set(name, value);
	}

	public cd(name: string): WritableFilesystem {
		if (this.directories.has(name)) {
			return this.directories.get(name) as WritableFilesystem;
		}

		const dir = new WritableFilesystem(this);
		this.directories.set(name, dir);

		return dir;
	}

	public build(): {
		readonly header: Buffer;
		readonly fileContents: Buffer;
	} {
		return {
			header: this.toBuffer(),
			fileContents: Buffer.concat(this.contentBuffers),
		};
	}

	private toBuffer(): Buffer {
		const dirs = Array.from(this.directories.values()).map((dir: WritableFilesystem) => dir.toBuffer());
		const dirNames = Array.from(this.directories.keys());
		const files = Array.from(this.files.keys());
		const headerSize = this.headerSize(dirs);
		const buffer = Buffer.alloc(headerSize);
		let offset = 0;

		// Storing the amount of directories
		offset = buffer.writeUInt16BE(dirs.length, offset);
		for (let i = 0; i < dirs.length; i++) {
			const dir = dirs[i];

			// Storing the directory name
			offset = writeString(buffer, dirNames[i], offset);
			// Writing the length of the dir slice
			offset = buffer.writeUInt32BE(dir.byteLength, offset);
			// Up until here is fine
			// Writing the dirslice
			buffer.set(dir, offset);
			offset += dir.byteLength;
		}
		// Storing the amount of files
		offset = buffer.writeUInt16BE(files.length, offset);
		for (let i = 0; i < files.length; i++) {
			const file = this.files.get(files[i])!;
			// Writing the file path
			offset = writeString(buffer, files[i], offset);
			// Writing the resource length offset.
			// This offset is set from the beginning of the header.
			const resourceOffset = this.store(file);
			offset = buffer.writeUInt32BE(resourceOffset, offset);
			offset = buffer.writeUInt32BE(file.byteLength, offset);
		}

		return buffer;
	}

	private headerSize(dirs: Buffer[]): number {
		const dirNames = Array.from(this.directories.keys());
		const files = Array.from(this.files.keys());
		const headerSize = 2 + // # of dirs
			dirs.map((d, i) => {
				// 2 byte for str len, then string
				const dirNameLen = 2 + Buffer.byteLength(dirNames[i], "utf8");
				// Length of subdir slice
				const dirLen = 4;
				return dirNameLen + dirLen + d.byteLength;
			}).reduce((p, c) => p + c, 0) +
			2 +
			files.map((f) => {
				const strLen = 2 + Buffer.byteLength(f, "utf8");
				return strLen + 4 + 4;
			}).reduce((p, c) => p + c, 0);

		return headerSize;
	}

	/**
	 * Bubbles to the main filesystem. Stores a buffer
	 * and returns the offset it'll be stored at.
	 */
	private store(buffer: Buffer): number {
		if (this.parent) {
			return this.parent.store(buffer);
		}

		const plen = this.contentLength;
		this.contentBuffers.push(buffer);
		this.contentLength += buffer.byteLength;

		return plen;
	}
}