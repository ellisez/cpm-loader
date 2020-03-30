const loader=require('./lib/loader');
const probe=require('./lib/probe');
module.exports=function (content) {
    const self=this;
    // 开启缓存
    self.cacheable && self.cacheable();

    const resourcePath=self.resourcePath;
    const code=loader.call(self, resourcePath, content, {});
    if (/main.js$/.test(this.resource)) debugger
    return code;
}

