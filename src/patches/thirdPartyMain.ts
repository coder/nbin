/**
 * Application entrypoint.
 * 
 * Patched to execute then continue normal node instantiation.
 * 
 * We can set `process.argv` here to easily passthrough.
 */
import * as nbin from "nbin";

if (!process.argv[1]) {
	process.argv[1] = nbin.mainFile;
}
