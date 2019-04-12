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
import ora, { Ora } from "ora";

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
		let spinner: Ora | undefined;
		if (this.canLog) {
			spinner = ora("Writing...");
		}
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const stat = fs.statSync(file);
			if (!stat.isFile()) {
				continue;
			}
			this.writeFile(file, fs.readFileSync(file));
			if (spinner) {
				spinner.text = `Wrote "${file}"!`;
			}
			if (callback) {
				callback(file);
			}
			fileCount++;
		}
		if (spinner) {
			spinner.succeed(`Wrote ${fileCount} ${fileCount === 1 ? "file" : "files"}!`);
		}
		return fileCount;
	}

	public writeModule(modulePath: string): void {
		if (!fs.existsSync(modulePath)) {
			throw new Error(`"${modulePath}" does not exist`);
		}
		const paths = glob.sync(path.join(modulePath, "**"))
		const moduleName = path.basename(modulePath);

		for (let i = 0; i < paths.length; i++) {
			const p = paths[i];
			const newPath = path.join("/node_modules", moduleName, path.relative(modulePath, p));
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

		// Create a buffer containing a (most likely) unique ID and its length.
		const idLength = 6;
		const possible = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
		const id = Array(idLength).fill(1)
			.map(() => possible[Math.floor(Math.random() * possible.length)])
			.join("");
		const idBuffer = Buffer.alloc(2 + Buffer.byteLength(id));
		writeString(idBuffer, id);

		// Writing the entrypoint
		const mainFileBuffer = Buffer.alloc(2 + Buffer.byteLength(this.options.mainFile));
		writeString(mainFileBuffer, this.options.mainFile);

		if (this.canLog) {
			logger.info("Building filesystem");
		}
		// Filesystem contents
		const fsBuffer = this.fs.build();

		// Footer
		const footerBuffer = createFooter(
			fsBuffer.header.byteLength + idBuffer.byteLength + mainFileBuffer.byteLength, // Header byte length
			nodeBuffer.byteLength, // Header byte offset
			fsBuffer.fileContents.byteLength, // File contents length
			nodeBuffer.byteLength + fsBuffer.header.byteLength + idBuffer.byteLength + mainFileBuffer.byteLength, // File contents offset
		);

		return Buffer.concat([nodeBuffer, idBuffer, mainFileBuffer, fsBuffer.header, fsBuffer.fileContents, footerBuffer]);
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
		if (this.canLog) {
			logger.info("Fetching", field("url", url));
		}

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
		const nodeVersion = "10.15.1";
		const packageJson = require("../../package.json");
		const packageVersion = packageJson.version;
		const binName = `${packageVersion}/node-${nodeVersion}-${currentPlatform}-${currentArchitecture}`;

		return binName;
	}

	private get canLog(): boolean {
		return !this.options.suppressOutput;
	}

}
