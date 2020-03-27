const compiler=require('./compiler');
const babel=require('babel-core');

module.exports=function (file, content, config) {if (file && file.endsWith('npm1\\src\\components\\login\\login.js')) debugger;
    const self=this;
    let result=compiler.call(self, file, content, config);
    // 使用postcss语法树
    let code=result.code;

    let needModifyAst=false;
    if (config && config.components && Object.keys(config.components).length>0) {
        needModifyAst=true;
    }

    if (!needModifyAst) {
        return { code:content };
    }

    // @import 'xxx'
    // url('xxx')
    const scanRegexp=/(?<import>(?<importPre>@import\s+(?<s>['"]))(?<importValue>.*?)(?<importSuf>\k<s>))|(?<url>(?<urlPre>url\s*\((?<ss>['"])?)(?<urlValue>.*?)(?<urlSuf>\k<ss>\)))/g;
    code=content.replace(scanRegexp, function (rawString) {
        const groups=arguments[arguments.length-1];
        if (groups.import) {
            const newUrl=config.components[groups.importValue];
            if (newUrl) {
                return groups.importPre + newUrl + groups.importSuf;
            }
        } else if (groups.url) {
            const newUrl=config.components[groups.urlValue];
            if (newUrl) {
                return groups.urlPre + newUrl + groups.urlSuf;
            }
        }
        return rawString;
    });
    return {code};
};
