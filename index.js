const loader=require('./lib/loader');
module.exports=function (content) {
    const self=this;
    // 开启缓存
    this.cacheable && this.cacheable();

    const resourcePath=this.resourcePath;
    const code=loader(resourcePath, content, {
        updateComponent(data) {
            self._compiler.applyPlugins('cpm-component', data);
        }
    });
    return code;
}

