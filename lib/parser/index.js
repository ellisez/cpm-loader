const path=require('path');
/**
 * 解析器: 探测组件依赖关系
 * @param file
 * @param content
 * @param config
 * @returns {*}
 */
module.exports=function (file, content, config) {
    const self=this;
    const ext=path.extname(file);
    let parser;
    switch (ext) {
        case '.js':
            parser=require('./js-parser');
            break;
        case '.vue':
            parser=require('./vue-parser');
            break;
        case '.css':
        case '.less':
            parser=require('./style-parser');
            break;
        default:
            return content;
    }
    return parser.call(self, file, content, config);
}
