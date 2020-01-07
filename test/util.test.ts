import * as assert from "assert"
import * as fs from "fs-extra"
import * as path from "path"
import * as os from "os"
import { mkdirp } from "../src/common/util"

const tmpDir = path.join(os.tmpdir(), "nbin/tests")

describe("util", () => {
  it("mkdirp", async () => {
    const target = path.join(tmpDir, "foo/bar/baz")
    assert.equal(mkdirp(target), undefined)
    assert.equal(await fs.pathExists(target), true)
    assert.equal(mkdirp(target), undefined) // Shouldn't throw if it exists.

    // In CI we have permissions so we'll write a file to force an error.
    try {
      await fs.writeFile("/file", "")
    } catch (error) {
      // No problem.
    }
    assert.throws(() => mkdirp(path.join("/file/foo/bar/baz")), /Error/)
  })
})
