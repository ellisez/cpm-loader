const vueCompiler=require('../compiler/vue-compiler');
const utils=require('../utils');
const path=require('path');

const jsParser=require('./js-parser');
const templateParser=require('./template-parser');
const styleParser=require('./style-parser');
module.exports=function (file, content, config) {
    const self=this;
    let result=vueCompiler.call(self, file, content, config);
    let code=result.code;
    // 使用vue语法树
    let ast=result.ast;

    const parts = utils.vuePartment(code);

    let needSaveComponent=false;
    if (utils.inProject(file)) {
        needSaveComponent=true;
    }

    if (!needSaveComponent) {
        return result;
    }

    // 解析js
    const script=parts.script;
    if (script) {
        const js = script.content;
        const jsResult = jsParser.call(self, file, js, {...config, offset: script.start});
    }

    // 解析模板
    const template=parts.template;
    if (template) {
        const jsx=template.content;
        const jsxResult=templateParser.call(self, file, jsx, {...config, offset: template.start});
    }

    // 解析样式
    const styles=parts.styles;
    if (styles && styles.length>0) {
        styles.map(function (style) {
            const styleCode=style.content;
            const styleResult=styleParser.call(self, file, styleCode, {...config, offset: style.start});
        })
    }

    return result;
};
