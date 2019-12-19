/**
 * Application entry point.
 */
import * as nbin from "nbin"

// Set the version globally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(process.versions as any).nbin = nbin.version

// Splice in the main file.
process.argv.splice(1, 0, nbin.mainFile)

// Kick things off by loading the main file.
require("module").runMain()
