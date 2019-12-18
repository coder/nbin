import * as assert from "assert"
import * as cp from "child_process"
import * as fs from "fs-extra"
import * as os from "os"
import * as path from "path"
import * as util from "util"
import * as zlib from "zlib"
import { Binary } from "../src/api/bundler"

// Add a default for the maximum memory.
process.env.NODE_OPTIONS = `--max-old-space-size=1024 ${process.env.NODE_OPTIONS || ""}`

let binId = 0
const nodePath = path.join(__dirname, "../lib/node/node")
const tmpDir = path.join(os.tmpdir(), "nbin/tests")
const runBinary = async (
  binary: Binary,
  expected?: { stdout?: string; stderr?: string }
): Promise<{ stdout: string; stderr: string }> => {
  const tmpFile = path.join(tmpDir, `${binId++}`)
  await fs.writeFile(tmpFile, await binary.build())
  await fs.chmod(tmpFile, "755")
  const output = await util.promisify(cp.exec)(tmpFile)
  assert.equal(output.stderr, (expected && expected.stderr) || "")
  assert.equal(output.stdout, (expected && expected.stdout) || "")
  return output
}

describe("bundler", () => {
  before(async () => {
    assert.equal(fs.existsSync(nodePath), true, "Node must be built locally to run bundler tests")
    await fs.mkdirp(tmpDir)
  })

  it("should error if running raw binary", async () => {
    assert.rejects(async () => {
      await util.promisify(cp.exec)(nodePath)
    }, /ERR_BUFFER_OUT_OF_BOUNDS/)
  })

  it("should compile binary and execute it", async () => {
    const mainFile = "/example.js"
    const bin = new Binary({ nodePath, mainFile })
    const stdout = "hello!"
    bin.writeFile(mainFile, `console.log("${stdout}");`)
    await runBinary(bin, { stdout })
  })

  /**
   * TODO: this should work on other platforms
   */
  if (process.platform === "linux") {
    it("should load native module", async () => {
      const mainFile = "/example.js"
      const bin = new Binary({ nodePath, mainFile })
      const stdout = "hi"
      bin.writeModule(path.join(__dirname, "../node_modules", "node-pty"))
      bin.writeFile(mainFile, `require("node-pty");console.log("${stdout}");`)
      await runBinary(bin, { stdout })
    })
  }

  it("should fork", async () => {
    const mainFile = "/example.js"
    const bin = new Binary({ nodePath, mainFile })

    const exampleContent = (): void => {
      process.env.NBIN_BYPASS = "true"
      const proc = require("child_process").fork("/test.js", [], {
        stdio: [null, null, null, "ipc"],
      })
      proc.stdout.on("data", (d: Buffer) => {
        console.log(d.toString("utf8"))
        setTimeout(() => process.exit(0), 10000)
      })
    }

    const stdout = "hi"
    bin.writeFile(mainFile, `(${exampleContent.toString()})()`)
    bin.writeFile("/test.js", `console.log("${stdout}");`)
    await runBinary(bin, { stdout })
  })

  /**
   * TODO: this should work on other platforms
   */
  if (process.platform === "linux") {
    it("should fill fs", async () => {
      const mainFile = "/example.js"
      const exampleContent = (): void => {
        const assert = require("assert") as typeof import("assert")
        const fs = require("fs") as typeof import("fs")
        const nbin = require("nbin") as typeof import("nbin")

        try {
          fs.readFileSync("/donkey/frog")
          process.exit(1) // Fail if we read successfully.
        } catch (ex) {
          nbin.shimNativeFs("/donkey")
          assert.equal(fs.readFileSync("/donkey/frog").toString(), "example")
          try {
            fs.writeFileSync("/donkey/banana", "asdf")
            process.exit(1)
          } catch (ex) {
            console.log("success")
          }
        }
      }
      const bin = new Binary({ nodePath, mainFile })
      bin.writeFile(mainFile, `(${exampleContent.toString()})()`)
      bin.writeFile("/donkey/frog", "example")
      await runBinary(bin, { stdout: "success" })
    })
  }

  it("should fill fs and propogate errors", async () => {
    const mainFile = "/example.js"
    const exampleContent = (): void => {
      const fs = require("fs") as typeof import("fs")
      const nbin = require("nbin") as typeof import("nbin")

      nbin.shimNativeFs("/home/kyle/node/coder/code-server/packages/server")
      fs.open("/home/kyle/node/coder/code-server/packages/server/build/web/auth/__webpack_hmr", "r", (err) => {
        if (err) {
          console.log("success")
          process.exit(0)
        }

        process.exit(1)
      })
    }
    const bin = new Binary({ nodePath, mainFile })
    bin.writeFile(mainFile, `(${exampleContent.toString()})()`)
    await runBinary(bin, { stdout: "success" })
  })

  it("should load gzip'd javascript", async () => {
    const mainFile = "/example.js.gz"
    const bin = new Binary({ nodePath, mainFile })
    const stdout = "success"
    bin.writeFile(mainFile, zlib.gzipSync(Buffer.from(`console.log("${stdout}");process.exit(0);`)))
    await runBinary(bin, { stdout })
  })
})
