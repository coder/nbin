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
  expected?: { stdout?: string; stderr?: string },
  env?: NodeJS.ProcessEnv,
  args?: string[]
): Promise<{ stdout: string; stderr: string }> => {
  const tmpFile = path.join(tmpDir, `${binId++}`)
  await fs.writeFile(tmpFile, await binary.build())
  await fs.chmod(tmpFile, "755")
  const output = await util.promisify(cp.exec)(`${tmpFile} ${(args || []).join(" ")}`, {
    env: {
      ...process.env,
      ...(env || {}),
    },
  })
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
    // TODO: If possible we could try to detect if anything has been bundled yet
    // and display an appropriate message.
    assert.rejects(async () => {
      await util.promisify(cp.exec)(nodePath)
    }, /ERR/) // out of bounds or out of range
  })

  it("should compile binary and execute it", async () => {
    const mainFile = "/example.js"
    const bin = new Binary({ nodePath, mainFile })
    const stdout = "hello!"
    bin.writeFile(mainFile, `process.stdout.write("${stdout}");`)
    await runBinary(bin, { stdout })
  })

  it("should bypass nbin", async () => {
    const mainFile = "/example.js"
    const bin = new Binary({ nodePath, mainFile })
    const stdout = "bypassed hello!"
    bin.writeFile(mainFile, `process.stdout.write("hello!");`)
    await runBinary(
      bin,
      { stdout },
      {
        NBIN_BYPASS: "true",
      },
      ["-e", `'process.stdout.write("${stdout}")'`]
    )
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
      bin.writeFile(mainFile, `require("node-pty");process.stdout.write("${stdout}");`)
      await runBinary(bin, { stdout })
    })
  }

  it("should fork and bypass nbin", async () => {
    const mainFile = "/example.js"
    const bin = new Binary({ nodePath, mainFile })

    const exampleContent = (): void => {
      process.env.NBIN_BYPASS = "true"
      const proc = require("child_process").fork("/test.js", [], {
        stdio: "inherit",
      })
      proc.on("message", (d: string) => {
        process.stdout.write(d)
        process.exit(0)
      })
    }

    const stdout = "hi"
    bin.writeFile(mainFile, `(${exampleContent.toString()})()`)
    bin.writeFile("/test.js", `process.send("${stdout}");`)
    await runBinary(bin, { stdout })
  })

  it("should fork and not bypass nbin", async () => {
    const mainFile = "/example.js"
    const bin = new Binary({ nodePath, mainFile })

    const exampleContent = (stdout: string): void => {
      if (!process.env.LOADED_NBIN) {
        process.env.LOADED_NBIN = "true"
        const proc = require("child_process").fork("/test.js", [], {
          stdio: "inherit",
        })
        proc.on("message", (d: string) => {
          process.stdout.write(d)
          process.exit(0)
        })
      } else {
        if (process.send) {
          process.send(stdout)
        } else {
          process.stderr.write("wasn't spawned with ipc")
        }
        process.exit(0)
      }
    }

    const stdout = "from the main file"
    bin.writeFile(mainFile, `(${exampleContent.toString()})("${stdout}")`)
    bin.writeFile("/test.js", `process.send("from the child");`)
    await runBinary(bin, { stdout })
  })

  /**
   * TODO: this should work on other platforms
   */
  if (process.platform === "linux") {
    it("should fill fs", async () => {
      const mainFile = "/example.js"
      const exampleContent = (stdout: string): void => {
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
            process.stdout.write(stdout)
          }
        }
      }
      const stdout = "success"
      const bin = new Binary({ nodePath, mainFile })
      bin.writeFile(mainFile, `(${exampleContent.toString()})("${stdout}")`)
      bin.writeFile("/donkey/frog", "example")
      await runBinary(bin, { stdout })
    })
  }

  it("should fill fs and propagate errors", async () => {
    const mainFile = "/example.js"
    const exampleContent = (stdout: string): void => {
      const fs = require("fs") as typeof import("fs")
      const nbin = require("nbin") as typeof import("nbin")

      nbin.shimNativeFs("/home/kyle/node/coder/code-server/packages/server")
      fs.open("/home/kyle/node/coder/code-server/packages/server/build/web/auth/__webpack_hmr", "r", (err) => {
        if (err) {
          process.stdout.write(stdout)
          process.exit(0)
        }

        process.exit(1)
      })
    }
    const stdout = "success"
    const bin = new Binary({ nodePath, mainFile })
    bin.writeFile(mainFile, `(${exampleContent.toString()})("${stdout}")`)
    await runBinary(bin, { stdout })
  })

  it("should load gzip'd javascript", async () => {
    const mainFile = "/example.js.gz"
    const bin = new Binary({ nodePath, mainFile })
    const stdout = "success"
    bin.writeFile(mainFile, zlib.gzipSync(Buffer.from(`process.stdout.write("${stdout}");process.exit(0);`)))
    await runBinary(bin, { stdout })
  })

  it("should pass options", async () => {
    const mainFile = "/example.js"
    const bin = new Binary({ nodePath, mainFile })
    const stdout = `["/example.js","--version"]`
    bin.writeFile(mainFile, `process.stdout.write(JSON.stringify(process.argv.slice(1)));process.exit(0);`)
    await runBinary(bin, { stdout: "v12.14.0\n" }, { NBIN_BYPASS: "true" }, ["--version"])
    await runBinary(bin, { stdout }, undefined, ["--version"])
  })
})
