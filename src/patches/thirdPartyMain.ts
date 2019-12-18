/**
 * Application entrypoint.
 *
 * Patched to execute then continue normal node instantiation.
 *
 * We can set `process.argv` here to easily passthrough.
 */
import * as nbin from "nbin"

/**
 * Specify the version of nbin this binary was built with.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(process.versions as any).nbin = nbin.version

/**
 * If bypassing nbin don't touch a thing.
 */
if (!process.env.NBIN_BYPASS) {
  process.argv.splice(1, 0, nbin.mainFile)
}
