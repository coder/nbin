# nbin

Fast and robust single-command node.js binary compiler.

## Usage

We *highly* recommend using webpack to bundle your sources. We do not scan source-files for modules to include.

When running within the binary, your application will have access to a module named [`nbin`](typings/nbin.d.ts).

Two packages are provided:
- `@coder/nbin` - available as an API to build binaries.
- `nbin` - *ONLY* available within your binary.

### Example

```ts
import { Binary } from "@coder/nbin";

const bin = new Binary({
	mainFile: "out/cli.js",
});

bin.writeFile("out/cli.js", Buffer.from("console.log('hi');"));
const output = bin.bundle();
```

### Webpack

If you are using webpack to bundle your `main`, you'll need to externalize modules.

```ts
// webpack.config.js

module.exports = {
	...
	external: {
		nbin: "commonjs nbin",
		// Additional modules to exclude
	},
};
```