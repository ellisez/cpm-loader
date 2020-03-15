const path=require('path');
const parser=require('./parser');

module.exports=function (resourcePath, content, config) {
    const result=parser(resourcePath, content, config);
    return result.code;
}
