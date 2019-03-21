/**
 * Application entrypoint.
 * 
 * Patched to execute then continue normal node instantiation.
 * 
 * We can set `process.argv` here to easily passthrough.
 */
import * as nbin from "nbin";

process.argv.splice(1, 0, nbin.mainFile);
