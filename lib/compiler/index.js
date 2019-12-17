const path=require('path');
/**
 * 编译器: 修改组件依赖关系
 * @param file
 * @param content
 * @param config
 * @returns {*}
 */
module.exports=function (file, content, config) {
    const ext=path.extname(file);
    let compiler;
    switch (ext) {
        case '.js':
            compiler=require('./js-compiler');
            break;
        case '.vue':
            compiler=require('./vue-compiler');
            break;
        case '.css':
        case '.less':
            compiler=require('./style-compiler');
            break;
        default:
            compiler=require('./compiler');;
    }
    return compiler(file, content, config);
}
