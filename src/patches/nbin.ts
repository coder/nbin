import * as fs from "fs";
import { Stat } from "nbin";
import * as path from "path";
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
