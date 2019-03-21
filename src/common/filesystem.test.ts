import { ReadableFilesystem, WritableFilesystem } from "./filesystem";

it("should find nested file", () => {
	const d = new WritableFilesystem();
	const subdir = d.cd("node_modules").cd("node-pty").cd("build").cd("Release");
	subdir.write("froggers", Buffer.from("wowza"));
	const buf = d.toBuffer();
	const od = ReadableFilesystem.fromBuffer(buf);
	expect(od.cd("node_modules").cd("node-pty").cd("build").cd("Release").read("froggers").toString()).toEqual("wowza");
});
