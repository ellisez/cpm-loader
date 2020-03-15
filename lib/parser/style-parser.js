const styleCompiler=require('../compiler/style-compiler');
const path=require('path');
const utils=require('../utils');

const cwd=process.env.CPM_DIRECTOR || process.cwd();

module.exports=function (file, content, config) {
    let result=styleCompiler(file, content, config);

    let code = result.code;
    let ast=result.ast;

    let needSaveComponent=false;
    if (config.updateComponent && utils.inProject(file)) {
        needSaveComponent=true;
    }

    if (!needSaveComponent) {
        return result;
    }

    const data={};
    const currentDir=path.dirname(file);

    const builder={
        component(url, range) {
            let result, regexp, groups;
            let component={};

            regexp=/^(?<name>\w[\-\w]*)([\/\\](?<path>[^]+))?$/g;
            if (result=regexp.exec(url)) {
                // import 'vue/lib/style-compiler'
                groups=result.groups;
                let name=groups.name;
                component.name=name;
                let pkg;
                try {
                    pkg = utils.readPkg(name);
                } catch (e) {
                    return null;
                }

                component.path='node_modules/'+name;
                const relativePath=groups.path;
                if (relativePath) {
                    range.path=relativePath.replace(/\\/g, '/');
                } else {
                    component.main=pkg.main || 'index.js';
                }
                // component version
                component.version=pkg.version;
                if (pkg.properties && pkg.properties.type) {
                    // components
                    component.container='components';
                    component.type=pkg.properties.type;
                } else {
                    // others
                    component.container='others';
                }
            } else {
                // type form url
                let importPath=utils.realPath(url, currentDir);
                if (!importPath) {
                    //throw new Error(`"${url}" not found in "${file}"`);
                    return null;
                }
                const relativePath=utils.relativePath(importPath);
                component.path=path.dirname(relativePath);
                let basename=path.basename(relativePath);
                if (basename!='index.js' && basename!='index.vue') {
                    range.path=basename;
                }
                component.container='privated';
                result=/src\/(?<name>(?<type>[^\/]+)(?:\/[^]*?)?)(?:\/index\.\w+)?$/.exec(component.path);
                if (result) {
                    groups=result.groups;
                    component.name=groups.name.replace(/\//g, '-');
                    switch (groups.type) {
                        case 'router':
                            // type=component
                            component.type='component';
                            break;
                        case 'store':
                            // type=data
                            component.type='data';
                            break;
                        case 'components':
                            // type=ui
                            component.type='ui';
                            break;
                        case 'template':
                            // type=layout
                            component.type='layout';
                            break;
                        case 'api':
                            // type=layout
                            component.type='api';
                            break;
                    }
                } else {
                    component.name=component.path.replace(/\//g, '-');
                }
            }
            return component;
        },
        sources(component, file, range) {
            const relativePath=utils.relativePath(file);
            const sources=component.sources=component.sources||{};
            const sourcesArray=sources[relativePath]=sources[relativePath]||[];
            // 去掉重复的
            let flag=true;
            for (let i=0; i<sourcesArray.length; i++) {
                let item=sourcesArray[i];
                if (item.start==range.start && item.end==range.end &&
                    item.type==range.type && item.raw==range.raw &&
                    item.path==range.path) {
                    flag=false;
                    break;
                }
            }
            if (flag) {
                sourcesArray.push(range);
            }
        },
    }

    const handler= {
        rangeMapping(index) {
            if (!config.rangeMapping) {
                return null;
            }
            for (let i = 0; i < config.rangeMapping.length; i++) {
                const mapping = config.rangeMapping[i];
                if (index >= mapping.to.start && index <= mapping.to.end) {
                    return {
                        start: mapping.from.start,
                        end: mapping.from.end,
                        type: 'source'
                    }
                }
            }
            return null;
        },

        componentSave(url, range, data) {
            let currentComponent = builder.component(url, range);
            if (!currentComponent) {
                return;
            }
            // 是否为父组件
            let parent = data.parent;
            if (parent && parent.name == currentComponent.name) {
                builder.sources(parent, file, range);
                return;
            }

            let container = currentComponent.container;
            container = data[container] = data[container] || [];

            // 排重写入sources
            let flag = true;
            for (let i = 0; i < container.length; i++) {
                let item = container[i];
                if (!item) {
                    continue;
                }
                if (item.path == currentComponent.path) {
                    builder.sources(item, file, range);
                    flag = false;
                    break;
                }
            }
            if (flag) {
                builder.sources(currentComponent, file, range);
                container.push(currentComponent);
            }
        },
        walk() {
            // @import 'xxx'
            // url('xxx')
            const scanRegexp=/(?<import>(?<importPre>@import\s+(?<s>['"]))(?<importValue>.*?)(?<importSuf>\k<s>))|(?<url>(?<urlPre>url\s*\((?<ss>['"])?)(?<urlValue>.*?)(?<urlSuf>\k<ss>\)))/g;
            code=code.replace(scanRegexp, function (rawString) {
                const groups=arguments[arguments.length-1];
                const input=arguments[arguments.length-2];
                const index=arguments[arguments.length-3];
                let url, start, end, type, prefix;
                if (groups.import) {
                    url=groups.importValue;
                    start = index + groups.importPre.length;
                    end = start + url.length;
                    type = 'style';
                    prefix='~';
                } else if (groups.url) {
                    url=groups.urlValue;
                    start = index + groups.urlPre.length;
                    end = start + url.length;
                    type = 'resource';
                    prefix='~';
                }

                let range=handler.rangeMapping(start);
                if (!range) {
                    if (config.offset) {
                        start+=config.offset;
                        end+=config.offset;
                    }
                    range = {
                        start,
                        end,
                        type,
                        raw: url
                    }
                }
                if (prefix) {
                    range.prefix=prefix;
                }
                handler.componentSave(url, range, data);

                return rawString;
            });
        }
    }

    handler.walk();

    result.code=code;
    if (needSaveComponent && Object.keys(data).length>0) {
        config.updateComponent(data);
    }
    return result;
};
