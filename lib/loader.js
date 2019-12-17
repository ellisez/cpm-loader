const path=require('path');
const plugins=require('../plugin');
const parser=require('./parser');

module.exports=function (resourcePath, content, config) {
    if (Object.keys(plugins).length==0) {
        return content;
    }

    const result=parser(resourcePath, content, config);
    return result.code;
}
