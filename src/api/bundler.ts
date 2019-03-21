import * as nbin from "@coder/nbin";
import * as fs from "fs";
import * as glob from "glob";
import * as path from "path";
import { writeString } from "../common/buffer";
import { WritableFilesystem } from "../common/filesystem";
import { createFooter } from "../common/footer";

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

	public writeFiles(globName: string): number {
		const files = glob.sync(globName, {
			cwd: process.cwd(),
		});
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			this.writeFile(file, fs.readFileSync(file));
		}
		return files.length;
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
	}

	public build(): Buffer {
		const nodeBinaryPath = this.options.nodePath || path.join(__dirname, "../../lib/node/out/Release/node");

		// Node binary contents
		const nodeBuffer = fs.readFileSync(nodeBinaryPath);
		
		// Writing the entrypoint
		const mainFileBuffer = Buffer.alloc(2 + Buffer.byteLength(this.options.mainFile));
		writeString(mainFileBuffer, this.options.mainFile);

		// Filesystem contents
		const fsBuffer = this.fs.toBuffer();

		// Footer
		const footerBuffer = createFooter(fsBuffer.byteLength + mainFileBuffer.byteLength, nodeBuffer.byteLength);

		return Buffer.concat([nodeBuffer, mainFileBuffer, fsBuffer, footerBuffer]);
	}

}
