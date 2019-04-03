import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Binary } from "./bundler";
import * as zlib from "zlib";

const nodePath = path.join(__dirname, "../../lib/node/out/Release/node");
if (!fs.existsSync(nodePath)) {
	throw new Error("Node must be built locally to run bundler test");
}
let binId = 0;
const runBinary = async (binary: Binary): Promise<cp.SpawnSyncReturns<Buffer>> => {
	const tmpFile = path.join(os.tmpdir(), ".nbin-bundlertest" + binId++);
	fs.writeFileSync(tmpFile, await binary.build());
	fs.chmodSync(tmpFile, "755");
	return cp.spawnSync(tmpFile, {
		env: {
			NODE_OPTIONS: "--max-old-space-size=4096",	
		},
	});
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

/**
 * TODO: this should work on other platforms
 */
if (process.platform === "linux") {
	it("should load native module", async () => {
		const mainFile = "/example.js";
		const bin = new Binary({
			nodePath,
			mainFile,
		});
		bin.writeModule(path.join(__dirname, "../../node_modules", "node-pty"));
		bin.writeFile(mainFile, Buffer.from(`require("node-pty");`));
		const resp = await runBinary(bin);
		expect(resp.stderr.toString().trim().length).toEqual(0);
	});
}

it("should fork", async () => {
	const mainFile = "/example.js";
	const bin = new Binary({
		nodePath,
		mainFile,
	});
	bin.writeFile(mainFile, Buffer.from(`const proc = require("child_process").fork("/test.js", [], { stdio: [null, null, null, "ipc"] });
proc.stdout.on("data", (d) => {
	console.log(d.toString("utf8"));
	setTimeout(() => process.exit(0), 10000);
});
	`));
	bin.writeFile("/test.js", Buffer.from("console.log('hi');"));
	const resp = await runBinary(bin);
	expect(resp.stdout.toString().trim()).toEqual("hi");
});

/**
 * TODO: this should work on other platforms
 */
if (process.platform === "linux") {
	it("should fill fs", async () => {
		const mainFile = "/example.js";
		const exampleContent = () => {
			const assert = require("assert") as typeof import("assert");
			const fs = require("fs") as typeof import("fs");
			const nbin = require("nbin") as typeof import("nbin");

			try {
				fs.readFileSync("/donkey/frog");
				// Fail if we read successfully
				process.exit(1);
			} catch (ex) {
				nbin.shimNativeFs("/donkey");
				assert.equal(fs.readFileSync("/donkey/frog").toString(), "example");
				try {
					fs.writeFileSync("/donkey/banana", "asdf");
					process.exit(1);
				} catch (ex) {
					// Expected
				}
			}
		};
		const bin = new Binary({
			nodePath,
			mainFile,
		});
		bin.writeFile(mainFile, Buffer.from(`(${exampleContent.toString()})()`));
		bin.writeFile("/donkey/frog", Buffer.from("example"));
		const resp = await runBinary(bin);
		if (resp.stdout.length > 0) {
			console.log(resp.stdout.toString());
		}
		expect(resp.stderr.toString().trim()).toEqual("");
	});
}

it("should fill fs and propogate errors", async () => {
	const mainFile = "/example.js";
	const exampleContent = () => {
		const fs = require("fs") as typeof import("fs");
		const nbin = require("nbin") as typeof import("nbin");

		nbin.shimNativeFs("/home/kyle/node/coder/code-server/packages/server");
		fs.open("/home/kyle/node/coder/code-server/packages/server/build/web/auth/__webpack_hmr", "r", (err) => {
			if (err) {
				// Expected
				process.exit(0);
			}

			process.exit(1);
		});
	};
	const bin = new Binary({
		nodePath,
		mainFile,
	});
	bin.writeFile(mainFile, Buffer.from(`(${exampleContent.toString()})()`));
	const resp = await runBinary(bin);
	if (resp.stderr.length > 0) {
		console.log(resp.stderr.toString());
	}
	expect(resp.stderr.toString().trim().length).toEqual(0);
});

it("should load gzip'd javascript", async () => {
	const mainFile = "/example.js.gz";
	const bin = new Binary({
		nodePath,
		mainFile,
	});
	bin.writeFile(mainFile, zlib.gzipSync(Buffer.from("process.exit(0);")));
	const resp = await runBinary(bin);
	if (resp.stderr.length > 0) {
		console.log(resp.stderr.toString());
	}
	expect(resp.stderr.toString().trim().length).toEqual(0);
});
