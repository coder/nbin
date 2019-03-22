import * as fs from "fs";
import { Stat } from "nbin";
import * as path from "path";
import * as util from "util";
import { readString } from "../common/buffer";
import { ReadableFilesystem } from "../common/filesystem";
import { readFooter } from "../common/footer";

const execPath = process.execPath;
const execPathStat = fs.statSync(execPath);
const nbinFd = fs.openSync(execPath, "r");

// Footer is located at the end of the file
const footer = readFooter(nbinFd, execPathStat.size);

// Contains the mainFile and the filesystem
const mainFileFsBuffer = Buffer.allocUnsafe(footer.byteLength);
fs.readSync(nbinFd, mainFileFsBuffer, 0, footer.byteLength, footer.byteOffset);

// Reading the mainfile
const mainFile = readString(mainFileFsBuffer, 0);

const fsBuffer = mainFileFsBuffer.slice(mainFile.offset);
const readableFs = ReadableFilesystem.fromBuffer(fsBuffer);

/**
 * Parses an entry from a readable FS.
 * Will split the inputted path and attempt to
 * nest down the tree.
 */
const parse = (fullPath: string): {
	readonly fs: ReadableFilesystem;
	readonly name: string;
} | undefined => {
	const parts = path.normalize(fullPath).split(path.sep).filter(i => i.length);
	let fs = readableFs;
	for (let i = 0; i < parts.length; i++) {
		if (!fs) {
			return;
		}
		const part = parts[i];
		if (i === parts.length - 1) {
			return {
				fs,
				name: part,
			};
		} else {
			fs = fs.cd(part);
		}
	}
};

const exported: typeof import("nbin") = {
	mainFile: mainFile.value,

	existsSync: (pathName: string): boolean => {
		const stat = exported.statSync(pathName);
		return stat.isFile || stat.isDirectory;
	},

	readFileSync: (pathName: string, encoding?: "utf8"): Buffer | string | undefined => {
		const res = parse(pathName);
		if (!res) {
			return undefined;
		}
		const b = res.fs.read(res.name);
		if (encoding && encoding === "utf8") {
			return b.toString();
		}
		return b;
	},

	statSync: (pathName: string): Stat => {
		const res = parse(pathName);
		if (!res) {
			return {
				isDirectory: false,
				isFile: false,
			};
		}
		return res.fs.stat(res.name);
	},
} as typeof import("nbin");

export = exported;

const nbinFsFill = {
	access: (path: string, constant: number, cb: (err?: Error) => void): void => {
		try {
			nbinFsFill.accessSync(path, constant);
			cb();
		} catch (ex) {
			cb(ex);
		}
	},
	accessSync: (path: string, constant: number): void => {
		if (constant === fs.constants.W_OK) {
			throw new Error("Cannot write to file within binary");
		}
	},
	appendFile: (path: fs.PathLike | number, data: any, options: (() => void) | {}, cb: (ex?: Error) => void) => {
		if (typeof options === "function") {
			cb = options as () => void;
		}

		try {
			nbinFsFill.appendFileSync(_, data, options);
		} catch (ex) {
			cb(ex);
		}
	},
	appendFileSync: (file: fs.PathLike | number, data: any, options: fs.WriteFileOptions = {}): void => {
		throw new Error("Cannot write to file within binary");
	},
	chmod: (() => {
		try {
			nbinFsFill.chmodSync(undefined!, undefined!);
		} catch (ex) {
			
		}
	}) as any,
	chmodSync: (() => {
		throw new Error("Cannot chmod to file within binary");
	}) as any,
} as typeof import("fs");

/**
 * Invalidated:
 * - appendFileSync
 * - chmodSync
 * - chownSync
 * - createWriteStream
 * - fchmodSync
 * - fchownSync
 * - fdatasyncSync
 * - fsyncSync
 * - ftruncateSync
 * - futimesSync
 * - lchmodSync
 * - lchownSync
 * - linkSync
 * - lstatSync
 * - mkdirSync
 * - readlinkSync
 * - renameSync
 * - rmdirSync
 * - symlinkSync
 * - truncateSync
 * - unlinkSync
 * - utimesSync
 * - writeSync
 * - writeFileSync
 * 
 * Filled:
 * - accessSync
 * - closeSync
 * - copyFileSync?
 * - createReadStream
 * - existsSync
 * - fstatSync
 * - openSync
 * - readSync
 * - readDirSync
 * - readFileSync
 * - realpathSync
 * - statSync
 */

const patchFs = (dirName: string): void => {
	const replaceNative = <T extends keyof typeof fs>(propertyName: T, func: (callOld: () => void, ...args: any[]) => any, customPromisify?: (...args: any[]) => Promise<any>): void => {
		const oldFunc = (<any>fs)[propertyName];
		fs[propertyName] = (...args: any[]): any => {
			try {
				return func(() => {
					return oldFunc(...args);
				}, ...args);
			} catch (ex) {
				return oldFunc(...args);
			}
		};
		if (customPromisify) {
			(<any>fs[propertyName])[util.promisify.custom] = (...args: any[]): any => {
				return customPromisify(...args).catch((ex) => {
					throw ex;
				});
			};
		}
	};

	const fillNativeFunc = <T extends keyof typeof fs>(propertyName: T): void => {
		replaceNative(propertyName, (callOld, newPath, ...args) => {
			if (typeof newPath !== "string") {
				return callOld();
			}

			const rel = path.relative(newPath, propertyName!);
			if (rel.startsWith("..") || !exported.existsSync(newPath)) {
				return callOld();
			}

			if (propertyName.endsWith("Sync")) {
				// 
			}

			const func = nativeFs[propertyName] as any;

			return func(newPath, ...args);
		});
	};

	const properties: Array<keyof typeof fs> = [
		"chmodSync",
		"chownSync",


		"existsSync",
		"readFile",
		"readFileSync",
		"createReadStream",
		"readdir",
		"readdirSync",
		"statSync",
		"stat",
		"realpath",
		"realpathSync",
	];
	properties.forEach((p) => fillNativeFunc(p));
};