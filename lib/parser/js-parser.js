const jsCompiler=require('../compiler/js-compiler');
const path=require('path');
const utils=require('../utils');
const probe=require('../probe');

const cwd=process.env.CPM_DIRECTOR || process.cwd();

module.exports=function (file, content, config) {
    const self=this;
    config.scan=[
        "string", "comment", "regexp"
    ];
    let result=jsCompiler.call(self, file, content, config);

    let ast=result.ast;

    let needSaveComponent=false;
    if (utils.inProject(file)) {
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
                let importPath=utils.resolvePath(self,currentDir, url);
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
                            component.type='page';
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

    const handler={
        rangeMapping(index) {
            if (!config.rangeMapping) {
                return null;
            }
            for (let i=0; i<config.rangeMapping.length; i++) {
                const mapping=config.rangeMapping[i];
                if (index>=mapping.to.start && index<=mapping.to.end) {
                    return {
                        start: mapping.from.start,
                        end: mapping.from.end,
                        type: 'source'
                    }
                }
            }
            return null;
        },
        componentAST(sourceASTPath, type) {
            const sourceAST=sourceASTPath.node;
            const raw=sourceAST.value;

            if (sourceAST.start===undefined) {
                return;
            }

            let start=sourceAST.start + 1;
            let end=sourceAST.end - 1;
            if (config.offset) {
                start+=config.offset;
                end+=config.offset;
            }
            let url=raw;

            let range = handler.rangeMapping(sourceAST.start);
            if (!range) {
                range = {
                    start,
                    end,
                    type
                }
            }
            range.raw = raw;
            handler.componentSave(url, range, data);

        },

        componentSave(url, range, data) {
            let currentComponent=builder.component(url, range);
            if (!currentComponent) {
                return;
            }
            // 是否为父组件
            let parent=data.parent;
            if (parent && parent.name==currentComponent.name) {
                builder.sources(parent, file, range);
                return;
            }

            let container=currentComponent.container;
            container=data[container]=data[container]||[];

            // 排重写入sources
            let flag=true;
            for (let i=0; i<container.length; i++) {
                let item=container[i];
                if (!item) {
                    continue;
                }
                if (item.path==currentComponent.path) {
                    builder.sources(item, file, range);
                    flag=false;
                    break;
                }
            }
            if (flag) {
                builder.sources(currentComponent, file, range);
                container.push(currentComponent);
            }
        },
        jsPlugin({types}) {
            return {
                name: 'cpm-js-parser',
                visitor: {
                    ImportDeclaration(nodepath) {
                        // import <xxx> from <url>
                        const sourceASTPath=nodepath.get('source');
                        if (!sourceASTPath.isStringLiteral()) {
                            return;
                        }
                        handler.componentAST(sourceASTPath, 'import');
                    },
                    ExportNamedDeclaration(nodepath) {

                    },
                    CallExpression(nodepath) {
                        // require.ensure([<url>])
                        // require(<url>)
                        // import(<url>)
                        let sourceASTPath;
                        const calleeASTPath=nodepath.get('callee');
                        if (calleeASTPath.isIdentifier()) {
                            if (calleeASTPath.node.name==='require' || calleeASTPath.node.name==='import') {
                                const sourceASTPath=nodepath.get('arguments')[0];
                                if (sourceASTPath && sourceASTPath.isStringLiteral()) {
                                    handler.componentAST(sourceASTPath, 'require');
                                }
                            }
                        } else if (calleeASTPath.isMemberExpression()) {
                            const objectASTPath=calleeASTPath.get('object');
                            const propertyASTPath=calleeASTPath.get('property');
                            if (objectASTPath.isIdentifier() && objectASTPath.node.name==='require' &&
                                propertyASTPath.isIdentifier() && propertyASTPath.node.name==='ensure') {
                                const paramArray=nodepath.get('arguments')[0];
                                if (paramArray.isArrayExpression()) {
                                    paramArray.get('elements').forEach(function (sourceASTPath) {
                                        if (sourceASTPath.isStringLiteral()) {
                                            handler.componentAST(sourceASTPath, 'require.ensure');
                                        }
                                    })
                                }
                            }
                        }
                    },
                }
            }
        }
    }
    // 使用babel语法树
    const options={
        filename: self.resource,
        plugins:[handler.jsPlugin]
    };
    let {code}=utils.babelCompile(result.code, options);
    if (needSaveComponent && Object.keys(data).length>0) {
        probe.updateData(data);
    }
    return {ast, code};
};
