const compiler=require('./compiler');
const path=require('path');
const fs=require('fs');
const utils=require('../utils');

module.exports=function (file, content, config) {
    const self=this;
    config.scan=[
        "string", "comment", "regexp"
    ];
    let result=compiler.call(self, file, content, config);

    let ast=result.ast;
    // 改写语法
    let needModifyAst=false;
    if ((config.components && Object.keys(config.components).length>0) ||
        (config.declarations && config.declarations.length>0)) {
        needModifyAst=true;
    }

    if (!needModifyAst) {
        return result;
    }

    const builder={

    }

    const handler={
        jsPlugin({types}) {
            function componentAST(sourceASTPath, type) {
                const sourceAST=sourceASTPath.node;
                const raw=sourceAST.value;
                if (sourceAST.start===undefined) {
                    return;
                }

                let url=raw;
                // 替换
                if (needModifyAst && config.components && config.components[url]) {
                    let newUrl=config.components[url];
                    sourceASTPath.replaceWith(types.stringLiteral(newUrl));
                    url=newUrl;
                }
            }
            function variableDeclarationAST(nodepath) {
                if (config.declarations && (nodepath.parentPath==null || nodepath.parentPath.parentPath==null)) {
                    // 只匹配根部声明的变量
                    const names=utils.nodeName(nodepath.node);
                    if (names.length!=config.declarations.length) {
                        return;
                    }
                    let declaration;
                    for (let i=0; i<names.length; i++) {
                        const name=names[i];
                        let hit=false;
                        for (let j=0; j<config.declarations.length; j++) {
                            declaration=config.declarations[j];
                            if (name==declaration.name) {
                                hit=true;
                                break;
                            }
                        }
                        if (!hit) {
                            return;
                        }
                    }
                    nodepath.replaceWith(declaration.node);
                    return true;
                }
            }

            return {
                name: 'cpm-js-compiler',
                visitor: {
                    VariableDeclaration(nodepath) {
                        variableDeclarationAST(nodepath);
                    },
                    FunctionDeclaration(nodepath) {
                        variableDeclarationAST(nodepath);
                    },
                    ImportDeclaration(nodepath) {
                        variableDeclarationAST(nodepath);
                        // import <xxx> from <url>
                        const sourceASTPath=nodepath.get('source');
                        if (!sourceASTPath.isStringLiteral()) {
                            return;
                        }
                        componentAST(sourceASTPath, 'import');
                    },
                    ExportNamedDeclaration(nodepath) {
                        variableDeclarationAST(nodepath);
                    },
                    ExportDefaultDeclaration(nodepath) {
                        variableDeclarationAST(nodepath);
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
                                    componentAST(sourceASTPath, 'require');
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
                                            componentAST(sourceASTPath, 'require.ensure');
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
    return {ast, code};
};
