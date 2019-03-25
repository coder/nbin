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
	const filled: Array<keyof typeof fs> = [];

	/**
	 * Replaces a native function with its filled counterpart.
	 */
	const replaceNative = <T extends keyof typeof fs>(propertyName: T, func: typeof fs[T]): void => {
		filled.push(propertyName);
		const nativeFunc = (<any>fs)[propertyName];
		fs[propertyName] = (...args: any[]): any => {
			try {
				//@ts-ignore
				return func(...args);
			} catch (ex) {
				return nativeFunc(...args);
			}
		};

		(<any>fs[propertyName]).native = nativeFunc;
	};

	//@ts-ignore
	const asyncBypass = <T1 extends keyof typeof fs, T2 extends keyof typeof fs, P = ReturnType<typeof fs[T2]>>(propertyName: T1, syncPropertyName: T2, syncResp?: (arg: ReturnType<typeof fs[T2]>) => P | void, promiseResp?: (arg: P) => any): void => {
		filled.push(propertyName);

		fs[propertyName] = (...args: any[]): any => {
			const syncFunc = (<any>fs)[syncPropertyName];
			const funcs = [];
			const nonFuncs = args.filter((t) => {
				if (typeof t === "function") {
					funcs.push(t);

					return false;
				}

				return true;
			});
			if (funcs.length === 0) {
				return;
			}
			const callFunc = (...args: any[]) => {
				process.nextTick(() => {
					funcs[0](...args);
				});
			};
			try {
				const resp = syncFunc(...nonFuncs);
				if (syncResp) {
					const newArgs = syncResp(resp);
					if (newArgs) {
						if (Array.isArray(newArgs)) {
							callFunc(null, ...newArgs);
						} else {
							callFunc(null, newArgs);
						}
					} else {
						callFunc();
					}
				} else {
					callFunc(null, resp);
				}
			} catch (ex) {
				callFunc(ex);
			}
		};

		(<any>fs[propertyName])[util.promisify.custom] = (...args: any[]): any => {
			return new Promise<any>((resolve, reject) => {
				// @ts-ignore
				fs[propertyName](...args, (err, ...args) => {
					if (err) {
						return reject(err);
					}

					// @ts-ignore
					const value = promiseResp ? promiseResp(...args) : args[0];
					resolve(value);
				});
			});
		};
	};

	asyncBypass("access", "accessSync");
	replaceNative("accessSync", (path, mode) => {
		if (!nbin.existsSync(path)) {
			throw new Error("File doesn't exist");
		}
	});

	asyncBypass("close", "closeSync");
	replaceNative("closeSync", (fd) => {
		if (!openFiles.has(fd)) {
			throw new Error(`fd not found: ${fd}`);
		}
		openFiles.delete(fd);
	});

	asyncBypass("copyFile", "copyFileSync");
	replaceNative("copyFileSync", (src, dest, flags) => {
		//
	});

	asyncBypass("exists", "existsSync");
	replaceNative("existsSync", (path) => {
		return nbin.existsSync(path);
	});

	asyncBypass("fstat", "fstatSync");
	replaceNative("fstatSync", (fd) => {
		const of = openFiles.get(fd);
		if (!of) {
			throw new Error("file not found");
		}
		return fs.statSync(of.path);
	});

	asyncBypass("lstat", "lstatSync");
	replaceNative("lstatSync", (pathName) => {
		return fs.statSync(pathName);
	});

	let fdId = 0;
	interface OpenFile {
		readonly path: string;
		readLocation: number;
	}
	const openFiles = new Map<number, OpenFile>();
	// asyncBypass("open", "openSync");
	const oldOpen = fs.open;
	// @ts-ignore
	replaceNative("open", (path, flags, mode, cb) => {
		if (typeof mode === "function") {
			cb = mode;
		}
		if (!nbin.existsSync(path)) {
			return fs.open(path, flags, mode, cb);
			// throw new Error("File not found");
		}
		const desc = fdId++;
		openFiles.set(desc, {
			path,
			readLocation: 0,
		});

		process.nextTick(() => {
			cb(null, desc);
		});
		// return desc;
	});
	replaceNative("openSync", (path, flags, mode) => {
		if (!nbin.existsSync(path)) {
			throw new Error("File not found");
		}
		const desc = fdId++;
		openFiles.set(desc, {
			path,
			readLocation: 0,
		});
		return desc;
	});

	/**
	 * Synchronously performs a read on an fd.
	 * Split for read and readSync having different signatures
	 */
	const doRead = (fd: number, buffer: Buffer, offset: number, length: number, position: number): {
		readonly buffer: Buffer;
		readonly bytesRead: number;
	} => {
		const openFile = openFiles.get(fd);
		if (!openFile) {
			throw new Error(`fd ${fd} not found: ` + new Error().stack);
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
		return {
			bytesRead: content.byteLength,
			buffer: content,
		};
	};

	const oldRead = fs.read;
	// @ts-ignore
	replaceNative("read", (fd: number, buffer: Buffer, offset: number, length: number, position: number, callback: (err: Error, bytesRead: number, buffer: Buffer) => void) => {
		try {
			const value = doRead(fd, buffer, offset, length, position);
			callback(null, value.bytesRead, value.buffer);
		} catch (ex) {
			oldRead(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
				if (err) {
					return callback(err, null, null);
				}

				callback(null, bytesRead, buffer);
			});
		}
	});
	(<any>fs.read)[util.promisify.custom] = (fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
		return new Promise((resolve, reject) => {
			fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
				if (err) {
					return reject(err);
				}

				resolve({
					bytesRead,
					buffer,
				});
			});
		});
	};
	// asyncBypass("read", "readSync");
	replaceNative("readSync", (fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
		return doRead(fd, buffer, offset, length, position).bytesRead;
	});

	asyncBypass("readdir", "readdirSync");
	// We're ignoring different output types for paths. eg. buffer
	// This should be implemented.
	// @ts-ignore
	replaceNative("readdirSync", (path): string[] => {
		return [...nbin.readdirSync(path)];
	});

	asyncBypass("readFile", "readFileSync");
	// @ts-ignore
	replaceNative("readFileSync", (path, options): string | Buffer => {
		let encoding: "utf8" | "buffer" = "buffer";

		if (typeof options === "string") {
			encoding = options as "utf8";
		}
		if (typeof options === "object") {
			const os = options as { encoding?: string | null; flag?: string; };
			if (os.encoding) {
				encoding = os.encoding as "utf8";
			}
		}

		return nbin.readFileSync(path, encoding as "buffer");
	});

	asyncBypass("realpath", "realpathSync");
	// @ts-ignore
	replaceNative("realpathSync", (p) => p);

	asyncBypass("stat", "statSync");
	replaceNative("statSync", (path) => {
		const stat = nbin.statSync(path);
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
	});

	const ignoreFill = [
		"ReadStream",
		"WriteStream",
		"createReadStream",
		"createWriteStream",
		"read",
		"write",
		"writeFile",
		"writeFileSync",
	];
	/**
	 * Attempts to polyfill ALL 
	 */
	Object.keys(fs).forEach((fsKey: keyof typeof fs) => {
		if (ignoreFill.indexOf(fsKey) !== -1) {
			return;
		}
		const oldFunc = (<any>fs)[fsKey];
		if (typeof oldFunc === "function") {
			const oldFuncPromisify = oldFunc[util.promisify.custom];

			const doOld = (oldFuncToCall, args: any[]) => {
				const callOld = () => {
					try {
						return oldFuncToCall(...args)
					} catch (ex) {
						throw ex;
					}
				};
				let realPath = args[0];
				if (typeof realPath === "number") {
					// It's an fd
					const newFd = args[0];
					if (openFiles.has(newFd)) {
						realPath = openFiles.get(newFd).path;
					}
				}
				if (typeof realPath === "string") {
					// It's a path
					const newPath = realPath;
					const rel = path.relative(pathName, newPath!);
					if (!rel.startsWith("..")) {
						// It's in the fill path
						// Do stuff here w/ the rest of the args
						if (fsKey.endsWith("Sync")) {
							if (filled.indexOf(fsKey) === -1) {
								throw new Error(`Function "${fsKey}" not filled for binary`);
							} else {
								return callOld();
							}
						}

						const cb = args.filter((a) => typeof a === "function");
						if (filled.indexOf(fsKey) !== -1 || cb.length === 0) {
							return callOld();
						}
						return cb[0](new Error(`Function "${fsKey}" not filled for binary`));
					}
				}

				if (oldFunc.native) {
					return oldFunc.native(...args);
				}

				return callOld();
			};

			// @ts-ignore
			fs[fsKey] = (...args: any[]): any => {
				return doOld(oldFunc, args);
			};

			if (oldFuncPromisify) {
				fs[fsKey][util.promisify.custom] = (...args: any[]): any => {
					return doOld(oldFuncPromisify, args);
				};
			}
		}
	});
};
