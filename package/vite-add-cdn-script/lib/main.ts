import path from "path";
import fs from "fs";
import { PluginOption } from "vite";
import { getPackageVersion } from "./utils";

enum EEnforce {
  PRE = "pre",
  POST = "post",
}

const cdnUrlObj = {
  jsdelivr: "cdn.jsdelivr.net/npm",
  unpkg: "unpkg.com",
};

const separators = {
  jsdelivr: "@",
  unpkg: "@",
};

export interface IOptions {
  protocol?: string;
  customScript?: { [key: string]: string };
  customFilepath?: { [key: string]: string };
  retryTimes?: number;
  defaultCdns?: string[];
}

function viteAddCdnScript(opt: IOptions): PluginOption {
  const {
    protocol = "https",
    customScript = {},
    retryTimes = 1,
    defaultCdns = ["jsdelivr", "unpkg"],
    customFilepath = {},
  } = opt;
  let _config;
  const _npmProObj = { ...customScript };

  return {
    name: "vite-add-cdn-script",
    enforce: EEnforce.PRE,
    apply: "build",
    config(confing) {
      _config = confing;
    },
    transformIndexHtml(html) {
      const packageJsonPath = path.resolve(process.cwd(), "package.json");
      try {
        const urlName = defaultCdns[0];
        const packageJson = fs.readFileSync(packageJsonPath, "utf-8");
        const packageData = JSON.parse(packageJson);
        const external = _config.build.rollupOptions.external;
        const errorScript = `<script>
  const separators = JSON.parse('${JSON.stringify(separators)}');
  const cdnUrlObj = JSON.parse('${JSON.stringify(cdnUrlObj)}');
  const defaultCdns = JSON.parse('${JSON.stringify(defaultCdns)}');
  function errorCDN(e) {
    const nextCur = parseInt(e.getAttribute("data-cur")) + 1;
    if(nextCur>=${retryTimes}){return;}
    const filename = e.getAttribute("data-filename");
    const key = e.getAttribute("data-key");
    const urlName = defaultCdns[nextCur]
    // 组装新的cdn链接
    const url = location.protocol + "//" + cdnUrlObj[urlName] + "/" + key + separators[urlName] + filename;
    // 克隆原标签
    const tagName = e.tagName
    const cdnDOM = document.createElement(tagName);
    cdnDOM.setAttribute(tagName === 'SCRIPT' ?'src' : 'href', url);
    Object.keys(e.dataset).forEach(_key => {
      cdnDOM.setAttribute('data-'+_key, e.dataset[_key]);
    })
    cdnDOM.setAttribute("data-cur", nextCur.toString());
    cdnDOM.setAttribute("onerror", "errorCDN(this)");
    document.head.appendChild(cdnDOM);
    e.remove();
  }
</script>`;

        let script = "" + errorScript;
        external.forEach((key) => {
          if (customScript[key]) {
            script += customScript[key];
          } else {
            const version = getPackageVersion(packageData, key);
            const fileName = version + "/" + (_npmProObj[key] ? _npmProObj[key] : `dist/${key}.min.js`);
            const url = `${protocol}://${cdnUrlObj[urlName]}/${key}${fileName}`;
            script += `<script src="${url}" type="text/javascript" crossorigin="anonymous" onerror="errorCDN(this)" data-cur="0" data-key="${key}" data-filename="${fileName}"></script>\n`;
          }
        });
        html = html.replace("</head>", `${script}</head>`);

        return html;
      } catch (error) {
        console.error("获取dependencies出错:", error);
      }
    },
  };
}
export default viteAddCdnScript;
