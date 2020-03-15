const fs=require('fs');
const path=require('path');
const utils=require('../lib/utils');
const compiler=require('../lib/compiler');

const cwd=process.env.CPM_DIRECTOR || process.cwd();

function configForComponent(directive, config) {debugger;
    directive.directives.some(function (item) {
        if (item.name==='component') {
            const [from, to]=item.params;
            if (!from) {
                throw new SyntaxError(`@component miss params!`);
            }
            config.components=config.components||{};

            let hit=false;
            for (let f in config.components) {
                let t=config.components[f];
                if (f==from || t==from) {
                    config.components[f]=to;
                    hit=true;
                    break;
                }
            }
            if (!hit) {
                config.components[from]=to;
            }
        }
    });
}

function configForBlock(directive, config) {
    if (directive.block) {
        utils.babelCompile(directive.block, function jsPlugin({types}) {
            function jsBlock(nodepath) {
                if (nodepath.parentPath==null || nodepath.parentPath.parentPath==null) {
                    // 只匹配根部声明的变量
                    const node = nodepath.node;
                    config.declarations = config.declarations || [];
                    config.declarations.push({
                        name: utils.nodeName(node),
                        node: node
                    });
                }
            }
            return {
                name: 'cpm-block-code',
                visitor: {
                    VariableDeclaration(nodepath) {
                        jsBlock(nodepath);
                    },
                    FunctionDeclaration(nodepath) {
                        jsBlock(nodepath);
                    },
                    ImportDeclaration(nodepath) {
                        jsBlock(nodepath);
                    },
                    ExportNamedDeclaration(nodepath) {
                        jsBlock(nodepath);
                    },
                    ExportDefaultDeclaration(nodepath) {
                        jsBlock(nodepath);
                    }
                }
            }
        })

    }
}

module.exports=function (file, {directive, parentConfig}) {

    const filePath=path.relative(cwd, file);

    if (!directive.params || directive.params.length==0) {
        return;
    }

    let rawUrl = directive.params[0];
    let url=utils.realPath(rawUrl);
    if (fs.existsSync(url)) {
        let content=fs.readFileSync(url).toString();
        const config={};
        // @line按行替换
        // @range按范围替换
        // @component按加载替换
        config.directive=directive;

        // 解析指令
        if (directive.directives) {
            directive.directives.map(function (item) {
                if (item.compile) {
                    const pluginResult = item.compile(item, url, content, config);
                    if (pluginResult) {
                        content = pluginResult;
                    }
                }
            });
        }

        // 解析block
        configForBlock(directive, config);

        if (!content) {
            return;
        }
        let code=`/// Beginning of ${rawUrl}\n${content}\n/// Ending of ${rawUrl}`;

        // rangeMapping
        parentConfig.rangeMapping=parentConfig.rangeMapping||[];
        parentConfig.rangeMapping.push({
            from: {
                start: directive.start,
                end: directive.end
            },
            to: {
                start: directive.start,
                end: directive.start+code.length
            }
        });

        const result=compiler(url, code, config);
        code=result.code;

        return code;
    }
};
