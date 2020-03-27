const path=require('path');
const parser=require('./parser');

module.exports=function (resourcePath, content, config) {
    const self=this;
    const result=parser.call(self, resourcePath, content, config);
    return result.code;
}
