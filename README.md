# nbin &middot; [!["Open Issues"](https://img.shields.io/github/issues-raw/cdr/nbin.svg)](https://github.com/cdr/nbin/issues) [!["Version"](https://img.shields.io/npm/v/@coder/nbin.svg)](https://www.npmjs.com/package/@coder/nbin) [![MIT license](https://img.shields.io/badge/license-MIT-green.svg)](#) [![Discord](https://discordapp.com/api/guilds/463752820026376202/widget.png)](https://discord.gg/zxSwN8Z)

Fast and robust node.js binary compiler.

**WARNING:** This project was created for
[code-server](https://github.com/cdr/code-server) and may provide limited
support.

Why was this made? Why not use `pkg` or `nexe`?

- Support for native node modules.
- No magic. The user specifies all customization. An example of this is
  overriding the file system.
- First-class support for multiple platforms.

## Usage

`nbin` does not do any kind of scanning for requiring files; it only includes
the files you tell it to. That means you should include everything (for example
by using `writeFiles('/path/to/repo/*')`) or use a bundler like Webpack and
include the bundle.

When running within the binary, your application will have access to a module
named [`nbin`](typings/nbin.d.ts).

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

### Forks

To use the compiled binary as the original Node binary set the `NBIN_BYPASS`
environment variable. This can be especially useful when forking processes (or
spawning with the binary). You might want to simply immediately set this to any
truthy value as soon as your code loads.

### Webpack

If you are using webpack to bundle your `main`, you'll need to externalize
modules.

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

### Environment

You can pass
[`NODE_OPTIONS`](https://nodejs.org/api/cli.html#cli_node_options_options).

```bash
NODE_OPTIONS="--inspect-brk" ./path/to/bin
```

Gzip'd JavaScript files are supported to reduce bundle size.

## Development

```
yarn
yarn build
```

When publishing use `npm` and not `yarn` as `yarn` will traverse ignored
directories anyway and re-add anything excluded by any discovered `.gitignore`
files.

### Patching

We patch Node to make it capable of reading files within the binary.

To generate a new patch, **stage all the changes** you want to be included in
the patch in the Node source, then run `yarn patch:generate` in this
directory.
