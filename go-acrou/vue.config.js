import { join } from "path";
import { forEach, map, filter } from "./dependencies-cdn";
import BuildAppJSPlugin from "./buildAppJSPlugin";
import CompressionWebpackPlugin from "compression-webpack-plugin";
import { set } from "lodash";

function resolve(dir) {
  return join(__dirname, dir);
}

// 增加环境变量
process.env.VUE_APP_VERSION = require("./package.json").version;
process.env.VUE_APP_G2INDEX_VERSION = require("./package.json").g2index;

process.env.VUE_APP_CDN_PATH =
  process.env.VUE_APP_CDN_PATH.replace(
    "@master",
    "@v" + process.env.VUE_APP_VERSION
  ) || "/";

// 基础路径 注意发布之前要先修改这里
let publicPath = process.env.VUE_APP_CDN_PATH || "/";
let cdnPath = process.env.VUE_APP_CDN_PATH;
const isProd = process.env.NODE_ENV === "production";

// 设置不参与构建的库
let externals = {};
forEach((item) => {
  externals[item.name] = item.library;
});

// 引入文件的 cdn 链接
const cdn = {
  css: map((e) => e.css).filter((e) => e),
  js: map((e) => e.js).filter((e) => e),
};
export default {
  publicPath,
  lintOnSave: true,
  css: {
    loaderOptions: {
      // 设置 scss 公用变量文件
      sass: {
        prependData: `$cdnPath: "${isProd ? cdnPath : "/"}";`,
      },
    },
  },
  configureWebpack: (config) => {
    const configNew = {};
    if (isProd) {
      configNew.externals = externals;
      configNew.plugins = [
        // gzip
        new CompressionWebpackPlugin({
          filename: "[path].gz[query]",
          test: new RegExp("\\.(" + ["js", "css"].join("|") + ")$"),
          threshold: 10240,
          minRatio: 0.8,
          deleteOriginalAssets: false,
        }),
      ];
    }
    return configNew;
  },

  chainWebpack: (config) => {
    config.plugin("BuildAppJSPlugin").use(BuildAppJSPlugin);
    /**
     * 添加 CDN 参数到 htmlWebpackPlugin 配置中
     */
    config.plugin("html").tap((options) => {
      if (isProd) {
        set(options, "[0].cdn", cdn);
      } else {
        set(options, "[0].cdn", {
          js: filter((e) => e.name === "").map((e) => e.js),
          css: filter((e) => e.name === "").map((e) => e.css),
        });
      }
      set(options, "[0].inject", false);
      return options;
    });
    /**
     * 删除懒加载模块的 prefetch preload，降低带宽压力
     * https://cli.vuejs.org/zh/guide/html-and-static-assets.html#prefetch
     * https://cli.vuejs.org/zh/guide/html-and-static-assets.html#preload
     * 而且预渲染时生成的 prefetch 标签是 modern 版本的，低版本浏览器是不需要的
     */
    if (isProd) {
      config.plugins.delete("prefetch").delete("preload");
    }
    // 解决 cli3 热更新失效 https://github.com/vuejs/vue-cli/issues/1559
    config.resolve.symlinks(true);
    config.resolve.alias
      .set("@", resolve("src"))
      .set("@assets", resolve("src/assets"))
      .set("@utils", resolve("src/utils"))
      .set("@api", resolve("src/api"))
      .set("@node_modules", resolve("node_modules"));

    // 分析工具
    if (process.env.npm_config_report) {
      config
        .plugin("webpack-bundle-analyzer")
        .use(require("webpack-bundle-analyzer").BundleAnalyzerPlugin);
    }
  },

  // 不输出 map 文件
  productionSourceMap: false,

  devServer: {
    publicPath,
    proxy: {
      "/api": {
        target: "https://fileman.aio.my.id/",
        ws: true,
        changeOrigin: true,
        pathRewrite: {
          "^/api": "",
        },
      },
    },
  },

  pluginOptions: {
    i18n: {
      locale: "en",
      fallbackLocale: "en",
      localeDir: "locales",
      enableInSFC: true,
    },
  },
};