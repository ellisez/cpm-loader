const templateCompiler=require('../compiler/template-compiler');
const path=require('path');
const utils=require('../utils');

const cwd=process.env.CPM_DIRECTOR || process.cwd();

module.exports=function (file, content, config) {
    const self=this;
    const webpackConfig=self._compilation.options;
    let result=templateCompiler.call(self, file, content, config);
    // 使用vue语法树
    let code=result.code;

    let needSaveComponent=false;
    if (config.updateComponent && utils.inProject(file)) {
        needSaveComponent=true;
    }

    if (!needSaveComponent) {
        return result;
    }

    const options= {
        video: ['src', 'poster'],
        source: 'src',
        img: 'src',
        image: ['xlink:href', 'href']
    };
    let pattern ='';
    for (let key in options) {
        let value=options[key];
        if (pattern) {
            pattern+='|';
        }
        let valuePattern=value;
        if (value instanceof Array) {
            valuePattern=value.join('|');
        }
        // <video src="">
        // <video poster=""/>
        pattern+=`(?<${key}>\\<${key}\\s.*?(?:${valuePattern}))`;
    }
    pattern=`(?<pre>(?:${pattern})\s*=\\s*(?<s>["']))(?<url>.*?)(?<suf>\\k<s>.*?\\/?\>)`;
    const scanRegexp=new RegExp(pattern, 'g');

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
                let importPath=utils.realPath(url, currentDir, webpackConfig);
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
            code=code.replace(scanRegexp, function(rawString) {
                const groups=arguments[arguments.length-1];
                const input=arguments[arguments.length-2];
                const index=arguments[arguments.length-3];

                let url=groups.url;
                let start = index + groups.pre.length;
                let end = start + url.length;
                let type = 'resource';

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
