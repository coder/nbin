const path = require("path");
const os = require("os");
const environment = process.env.NODE_ENV || "development";
const HappyPack = require("happypack");
const webpack = require("webpack");

const root = path.resolve(__dirname);
const pkg = require("./package.json");

const baseConfig = {
	context: root,
	devtool: "none",
	target: "node",
	module: {
		rules: [{
			use: [
				{
					loader: "string-replace-loader",
					options: {
						search: "<NBIN_VERSION>",
						replace: pkg.version,
					},
				},
				"happypack/loader?id=ts",
			],
			test: /(^.?|\.[^d]|[^.]d|[^.][^d])\.tsx?$/,
		}, {
			use: [{
				loader: "node-loader",
			}],
			test: /\.node$/,
		}],
	},
	mode: "production",
	node: {
		__dirname: true,
	},
	plugins: [
		new HappyPack({
			id: "ts",
			threads: Math.max(os.cpus().length - 1, 1),
			loaders: [{
				path: "ts-loader",
				query: {
					happyPackMode: true,
				},
			}],
		}),
		new webpack.DefinePlugin({
			"process.env.NODE_ENV": `"${environment}"`,
		}),
	],
	resolve: {
		extensions: [".js", ".jsx", ".ts", ".tsx"],
	},
	stats: {
		all: false, // Fallback for options not defined.
		errors: true,
		warnings: true,
	},
};

module.exports = [
	{
		...baseConfig,
		entry: path.join(root, "src", "patches", "thirdPartyMain.ts"),
		output: {
			path: path.join(root, "lib", "node", "lib"),
			filename: "_third_party_main.js",
		},
		externals: {
			nbin: "commonjs nbin",
		},
	},
	{
		...baseConfig,
		entry: path.join(root, "src", "patches", "nbin.ts"),
		output: {
			path: path.join(root, "lib", "node"),
			filename: "nbin.js",
			libraryTarget: "commonjs",
		},
		externals: {
			nbin: "commonjs nbin",
		},
	},
	{
		...baseConfig,
		entry: path.join(root, "src", "api", "index.ts"),
		output: {
			path: path.join(root, "out"),
			filename: "api.js",
			libraryTarget: "commonjs",
		},
	}
];
