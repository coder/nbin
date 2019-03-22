import { mkdirpSync, writeFileSync } from "fs-extra";
import * as path from "path";
import { Binary } from "../out/api";

const dirName = path.resolve(__dirname);
const bin = new Binary({
	nodePath: path.join(dirName, "..", "lib", "node", "out", "Release", "node"),
	mainFile: path.join(dirName, "src", "hello.js"),
});
bin.writeFiles(path.join(dirName, "src/**"));
bin.build().then((buffer) => {
	const outDir = path.join(dirName, "out");
	mkdirpSync(outDir);
	writeFileSync(path.join(outDir, "example"), buffer, {
		mode: "755",
	});
});