import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Binary } from "./bundler";

const nodePath = path.join(__dirname, "../../lib/node/out/Release/node");
if (!fs.existsSync(nodePath)) {
	throw new Error("Node must be built locally to run bundler test");
}
const tmpFile = path.join(os.tmpdir(), ".nbin-bundlertest");
const runBinary = async (binary: Binary): Promise<cp.SpawnSyncReturns<Buffer>> => {
	fs.writeFileSync(tmpFile, await binary.build());
	fs.chmodSync(tmpFile, "755");
	return cp.spawnSync(tmpFile);
};

it("should compile binary and execute it", async () => {
	const mainFile = "/example.js";
	const bin = new Binary({
		nodePath,
		mainFile,
	});
	const output = "hello!";
	bin.writeFile(mainFile, Buffer.from(`console.log("${output}");`));
	const resp = await runBinary(bin);
	expect(resp.stdout.toString().trim()).toEqual(output);
});

it("should load native module", async () => {
	const mainFile = "/example.js";
	const bin = new Binary({
		nodePath,
		mainFile,
	});
	bin.writeModule("node-pty");
	bin.writeFile(mainFile, Buffer.from(`require("node-pty");`));
	const resp = await runBinary(bin);
	expect(resp.status).toEqual(0);
});

it("should fork", async () => {
	const mainFile = "/example.js";
	const bin = new Binary({
		nodePath,
		mainFile,
	});
	bin.writeFile(mainFile, Buffer.from(`const proc = require("child_process").fork("/test.js", [], { stdio: [null, null, null, "ipc"] });
proc.stdout.on("data", (d) => {
	console.log(d.toString("utf8"));
	process.exit(0);
});
	`));
	bin.writeFile("/test.js", Buffer.from("console.log('hi');"));
	const resp = await runBinary(bin);
	expect(resp.stdout.toString().trim()).toEqual("hi");
});