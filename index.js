const loader=require('./lib/loader');
module.exports=function (content) {
    const self=this;
    // 开启缓存
    self.cacheable && self.cacheable();

    const resourcePath=self.resourcePath;
    const code=loader.call(self, resourcePath, content, {
        updateComponent(data) {
            self._compiler.hooks.CpmComponent.call(data);
        }
    });
    return code;
}

