import { ReadableFilesystem, WritableFilesystem } from "./filesystem";

// it("should find nested file", () => {
// 	const d = new WritableFilesystem();
// 	const subdir = d.cd("node_modules").cd("node-pty").cd("build").cd("Release");
// 	subdir.write("froggers", Buffer.from("wowza"));
// 	const buf = d.build();
// 	const od = ReadableFilesystem.fromBuffer(Buffer.concat([buf.header, buf.fileContents]), {
// 		readContents: (offset, length) => 
// 	});
// 	expect(od.cd("node_modules").cd("node-pty").cd("build").cd("Release").read("froggers").toString()).toEqual("wowza");
// });
