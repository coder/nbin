/**
 * A patch for `fs` permitting certain directories to be routed within the binary.
 */
import * as fs from "fs";
import * as nbin from "nbin";
import * as path from "path";
import * as util from "util";

/**
 * Fills `${pathName}/*` with the binary stuff.
 */
export const fillFs = (pathName: string): void => {
	const override = <T extends keyof typeof fs>(propertyName: T, callback: (callOld: () => any) => typeof fs[T], customPromisify?: (...args: any[]) => Promise<any>) => {
		const oldfunc = fs[propertyName];
		/**
		 * Overridding the FS func
		 */
		fs[propertyName] = (...args: any[]): any => {
			const callOld = (): any => {
				// @ts-ignore
				return oldfunc(...args);
			};

			let realPath = args[0];

			/**
			 * If this is a number, its likely a file descriptor
			 */
			if (typeof realPath === "number") {
				const newFd = args[0];
				if (openFiles.has(newFd)) {
					realPath = openFiles.get(newFd).path;
				}
			}

			/**
			 * If this is a string, its likely a filepath
			 */
			if (typeof realPath === "string") {
				const newPath = realPath;
				const rel = path.relative(pathName, newPath!);
				if (!rel.startsWith("..")) {
					// It's in the fill path
					// Do stuff here w/ the rest of the args

					const func = callback(() => callOld());

					// @ts-ignore
					return func(...args);
				}
			}

			return callOld();
		};

		if (customPromisify) {
			fs[propertyName][util.promisify.custom] = customPromisify;
		}
	};

	let fdId = 0;
	interface OpenFile {
		readonly path: string;
		readLocation: number;
	}
	const openFiles = new Map<number, OpenFile>();
	const findCb = (args: any[]): undefined | ((...args: any[]) => void) => {
		const cb = args.filter((d) => {
			return typeof d === "function";
		});
		if (cb.length === 0) {
			return;
		}
		return cb[0];
	};

	// @ts-ignore
	override("access", (callOld) => (pathName: string) => {
		if (!nbin.existsSync(pathName)) {
			return callOld();
		}
	});

	override("accessSync", (callOld) => (pathName: string) => {
		if (!nbin.existsSync(pathName)) {
			return callOld();
		}
	});

	// @ts-ignore
	override("close", (callOld) => (fd, callback) => {
		if (!openFiles.has(fd)) {
			return callOld();
		}

		openFiles.delete(fd);
		callback(null);
	});

	override("closeSync", (callOld) => (fd) => {
		if (!openFiles.has(fd)) {
			return callOld();
		}

		openFiles.delete(fd);
	});

	// @ts-ignore
	override("exists", (callOld) => (pathName: string, callback) => {
		callback(nbin.existsSync(pathName));
	}, (pathName: string) => {
		return new Promise((resolve, reject) => {
			return fs.exists(pathName, (exists) => {
				resolve(exists);
			});
		});
	});

	override("existsSync", (callOld) => (pathName: string) => {
		return nbin.existsSync(pathName);
	});

	// @ts-ignore
	override("fstat", (callOld) => (fd, callback) => {
		if (!openFiles.has(fd)) {
			return callOld();
		}

		const openFile = openFiles.get(fd);
		return fs.stat(openFile.path, callback);
	});

	override("fstatSync", (callOld) => (fd) => {
		if (!openFiles.has(fd)) {
			return callOld();
		}

		const openFile = openFiles.get(fd);
		return fs.statSync(openFile.path);
	});

	// @ts-ignore
	override("lstat", (callOld) => (pathName, callback) => {
		return fs.stat(pathName, callback);
	});

	override("lstatSync", (callOld) => (pathName) => {
		return fs.statSync(pathName);
	});

	const doOpen = (pathName: string): number => {
		const desc = fdId++;
		openFiles.set(desc, {
			path: pathName,
			readLocation: 0,
		});
		return desc;
	};

	// @ts-ignore
	override("open", (callOld) => (pathName: string, ...args: any[]) => {
		if (!nbin.existsSync(pathName)) {
			return callOld();
		}
		const fd = doOpen(pathName);
		const cb = findCb(args);
		if (!cb) {
			return;
		}
		process.nextTick(() => {
			cb(null, fd);
		});
	});

	override("openSync", (callOld) => (pathName: string) => {
		if (!nbin.existsSync(pathName)) {
			return callOld();
		}
		return doOpen(pathName);
	});

	// @ts-ignore
	override("read", (callOld) => (fd, buffer: Buffer, offset, length, position, callback) => {
		const openFile = openFiles.get(fd);
		if (!openFile) {
			return callOld();
		}

		let hadPosition = true;
		if (typeof position === "undefined" || position === null) {
			position = openFile.readLocation;
			hadPosition = false;
		}
		nbin.readFile(openFile.path, "buffer", position, length).then((content) => {
			buffer.set(content, offset);
			if (!hadPosition) {
				openFile.readLocation += content.byteLength;
			}
			// tslint:disable-next-line:no-any
			callback(null, content.byteLength, content as any);
		}).catch((ex) => {
			callback(ex, null, null);
		});
	}, (fd, buffer: Buffer, offset, length, position) => {
		return new Promise((resolve, reject) => {
			return fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
				if (err) {
					return reject(err);
				}

				resolve({
					bytesRead,
					buffer,
				});
			});
		});
	});

	override("readSync", (callOld) => (fd, buffer: Buffer, offset, length, position): number => {
		const openFile = openFiles.get(fd);
		if (!openFile) {
			return callOld();
		}

		let hadPosition = true;
		if (typeof position === "undefined" || position === null) {
			position = openFile.readLocation;
			hadPosition = false;
		}
		const content = nbin.readFileSync(openFile.path, "buffer", position, length);
		buffer.set(content, offset);
		if (!hadPosition) {
			openFile.readLocation += content.byteLength;
		}
		return content.byteLength;
	});

	// @ts-ignore
	override("readdir", (callOld) => (pathName: string, ...args: any[]) => {
		const cb = findCb(args);
		if (!cb) {
			return;
		}
		cb(null, nbin.readdirSync(pathName));
	});

	// @ts-ignore
	override("readdirSync", (callOld) => (pathName: string) => {
		return [...nbin.readdirSync(pathName)];
	});

	// @ts-ignore
	override("readFile", (callOld) => (pathName: string, ...args: any[]) => {
		let encoding: "utf8" | "buffer" = "buffer";
		if (typeof args[0] === "string") {
			encoding = args[0];
		}
		if (typeof args[0] === "object" && args[0] !== null) {
			const opts = args[0];
			if (opts.encoding) {
				encoding = opts.encoding;
			}
		}
		const cb = findCb(args);
		if (!cb) {
			return;
		}
		nbin.readFile(pathName, encoding as "utf8").then((result) => {
			cb(null, result);
		}).catch((ex) => {
			cb(ex);
		});
	});

	// @ts-ignore
	override("readFileSync", (callOld) => (pathName: string, ...args: any[]) => {
		let encoding: "utf8" | "buffer" = "buffer";
		if (typeof args[0] === "string") {
			encoding = args[0];
		}
		if (typeof args[0] === "object" && args[0] !== null) {
			const opts = args[0];
			if (opts.encoding) {
				encoding = opts.encoding;
			}
		}
		return nbin.readFileSync(pathName, encoding as "buffer");
	});

	// @ts-ignore
	override("realpath", (callOld) => (pathName: string, ...args: any[]) => {
		const cb = findCb(args);
		if (!cb) {
			return;
		}
		cb(null, pathName);
	});

	// @ts-ignore
	override("realpathSync", (callOld) => (pathName: string) => {
		return pathName;
	});

	const doStat = (pathName: string): fs.Stats => {
		const stat = nbin.statSync(pathName);
		const date = new Date();

		return new class {
			isBlockDevice() { return false; }
			isCharacterDevice() { return false; }
			isDirectory() { return stat.isDirectory; }
			isFIFO() { return false; }
			isFile() { return stat.isFile; }
			isSocket() { return false; }
			isSymbolicLink() { return false; }

			public readonly atime = date;
			public readonly atimeMs = date.getTime();
			public readonly birthtime = date;
			public readonly birthtimeMs = date.getTime();
			public readonly blksize = null!;
			public readonly blocks = null!;
			public readonly ctime = date;
			public readonly ctimeMs = date.getTime();
			public readonly dev = null!;
			public readonly gid = 0;
			public readonly ino = 0;
			public readonly mode = null!;
			public readonly mtime = date;
			public readonly mtimeMs = date.getTime();
			public readonly nlink = null!;
			public readonly rdev = null!;
			public readonly size = stat.size;
			public readonly uid = 0;
		};
	};

	// @ts-ignore
	override("stat", (callOld) => (pathName: string, ...args: any[]) => {
		const cb = findCb(args);
		if (!cb) {
			return;
		}
		cb(null, doStat(pathName));
	});

	override("statSync", (callOld) => (pathName: string) => {
		return doStat(pathName);
	});
};
