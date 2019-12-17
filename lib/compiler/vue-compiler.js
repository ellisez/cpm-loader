const compiler=require('./compiler');
const utils=require('../utils');

const jsCompiler = require('./js-compiler');
const templateCompiler = require('./template-compiler');
const styleCompiler = require('./style-compiler');

module.exports=function (file, content, config) {
    let result=compiler(file, content, config);
    // 使用vue语法树
    let code=result.code;
    const parts = utils.vuePartment(content);

    const offsetRange=[];

    const handler={
        queryRange(start, end) {
            let offset=0;
            for (let i=0; i<offsetRange.length; i++) {
                const item = offsetRange[i];
                if (start>item.index) {
                    offset+=item.offset;
                }
            }
            return {
                start: start+offset,
                end: end+offset
            }
        },
        replaceContent(content, start, end, newString) {
            const range=handler.queryRange(start, end);
            let offset=newString.length-(range.end-range.start);
            if (offset!=0) {
                offsetRange.push({
                    index: range.end,
                    offset
                });
            }
            return content.substring(0, range.start)+newString+content.substring(range.end);
        }
    }

    // 替换js
    const script=parts.script;
    if (script) {
        const js = script.content;
        const jsResult = jsCompiler(file, js, config);
        code=handler.replaceContent(code, script.start, script.end, jsResult.code);
    }

    // 替换模板
    const template=parts.template;
    if (template) {
        const jsx=template.content;
        const jsxResult=templateCompiler(file, jsx, config);
        code=handler.replaceContent(code, template.start, template.end, jsxResult.code);
    }

    // 替换样式
    const styles=parts.styles;
    if (styles && styles.length>0) {
        styles.map(function (style) {
            const styleCode=style.content;
            const styleResult=styleCompiler(file, styleCode, config);
            code=handler.replaceContent(code, style.start, style.end, styleResult.code);
        })
    }

    result.code=code;
    return result;
};
