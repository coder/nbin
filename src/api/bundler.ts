import { field, logger } from "@coder/logger";
import * as nbin from "@coder/nbin";
import * as fs from "fs";
import * as fse from "fs-extra";
import * as glob from "glob";
import fetch from "node-fetch";
import * as os from "os";
import * as path from "path";
import { writeString } from "../common/buffer";
import { WritableFilesystem } from "../common/filesystem";
import { createFooter } from "../common/footer";

declare const __non_webpack_require__: typeof require;

export class Binary implements nbin.Binary {
	private readonly fs: WritableFilesystem = new WritableFilesystem();

	public constructor(
		private readonly options: nbin.BinaryOptions,
	) {}

	public writeFile(pathName: string, content: Buffer): void {
		const parts = path.normalize(pathName).split(path.sep).filter((i) => i.length);
		let writableFs: WritableFilesystem = this.fs;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (i === parts.length - 1) {
				writableFs.write(part, content);
			} else {
				writableFs = writableFs.cd(part);
			}
		}
	}

	public writeFiles(globName: string, callback?: (fileWritten: string) => void): number {
		const files = glob.sync(globName, {
			cwd: process.cwd(),
		});
		let fileCount: number = 0;
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const stat = fs.statSync(file);
			if (!stat.isFile()) {
				continue;
			}
			this.writeFile(file, fs.readFileSync(file));
			if (this.canLog) {
				logger.info("Wrote file", field("file", file));
			}
			if (callback) {
				callback(file);
			}
			fileCount++;
		}
		return fileCount;
	}

	public writeModule(moduleName: string): void {
		if (!moduleName.endsWith("package.json")) {
			moduleName = path.join(moduleName, "package.json");
		}
		const modPath = path.dirname(require.resolve(moduleName));
		const paths = glob.sync(path.join(modPath, "**"))

		for (let i = 0; i < paths.length; i++) {
			const p = paths[i];
			const newPath = path.join("/node_modules", path.dirname(moduleName), path.relative(modPath, p));
			const stat = fs.statSync(p);
			if (!stat.isFile()) {
				continue;
			}
			this.writeFile(newPath, fs.readFileSync(p));
		}
		if (this.canLog) {
			logger.info("Packaged module", field("module", moduleName));
		}
	}

	public async build(): Promise<Buffer> {
		const nodeBuffer = await this.cacheBinary();

		// Writing the entrypoint
		const mainFileBuffer = Buffer.alloc(2 + Buffer.byteLength(this.options.mainFile));
		writeString(mainFileBuffer, this.options.mainFile);

		if (this.canLog) {
			logger.info("Building filesystem");
		}
		// Filesystem contents
		const fsBuffer = this.fs.toBuffer();

		// Footer
		const footerBuffer = createFooter(fsBuffer.byteLength + mainFileBuffer.byteLength, nodeBuffer.byteLength);

		return Buffer.concat([nodeBuffer, mainFileBuffer, fsBuffer, footerBuffer]);
	}

	private async cacheBinary(): Promise<Buffer> {
		let nodeBinaryPath = this.options.nodePath || path.join(__dirname, "../../lib/node/out/Release/node");
		const nodeBinaryName = this.nodeBinaryName;
		
		const cacheDir = path.join(os.homedir(), ".nbin");
		if (!fs.existsSync(nodeBinaryPath)) {
			if (!fs.existsSync(cacheDir)) {
				if (this.canLog) {
					logger.info("Creating node binary cache directory");
				}
				fse.mkdirpSync(cacheDir);
			}
			nodeBinaryPath = path.join(cacheDir, nodeBinaryName);
		}

		if (fs.existsSync(nodeBinaryPath)) {
			if (this.canLog) {
				logger.info("Returning cached binary", field("binary-name", nodeBinaryName));
			}
			return fs.readFileSync(nodeBinaryPath);
		} else {
			// The pulled binary we need doesn't exist
			const binary = await this.fetchNodeBinary();
			fse.mkdirpSync(path.dirname(path.join(cacheDir, nodeBinaryName)));
			fse.writeFileSync(path.join(cacheDir, nodeBinaryName), binary);

			if (this.canLog) {
				logger.info("Wrote and cached binary", field("binary-name", nodeBinaryName), field("path", path.join(cacheDir, nodeBinaryName)));
			}
			return binary;
		}
	}

	private async fetchNodeBinary(): Promise<Buffer> {
		const binName = this.nodeBinaryName;
		const url = `https://nbin.cdr.sh/${binName}`;

		const resp = await fetch(url);
		if (resp.status !== 200) {
			throw new Error(resp.statusText);
		}
		const buffer = await resp.arrayBuffer();

		return Buffer.from(buffer);
	}

	private get nodeBinaryName(): string {
		const currentPlatform = os.platform();
		let currentArchitecture = os.arch();
		if (currentArchitecture === "x64") {
			currentArchitecture = "x86_64";
		}
		const nodeVersion = "8.15.0";
		let dirName = path.join(path.resolve(__dirname), "../");
		if (!fs.existsSync(path.join(dirName, "package.json"))) {
			dirName = path.join(path.resolve(__dirname), "../../");
		}
		const packageVersion = (typeof __non_webpack_require__ !== "undefined" ? __non_webpack_require__ : require)(path.join(dirName, "package.json")).version;
		const binName = `${packageVersion}/node-${nodeVersion}-${currentPlatform}-${currentArchitecture}`;

		return binName;
	}

	private get canLog(): boolean {
		return !this.options.suppressOutput;
	}

}
