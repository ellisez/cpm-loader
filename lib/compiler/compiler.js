const pluginManager=require('../../plugin');

function compiler(file, content, config={}) {
    const self=this;
    let index=0, nextIndex=0;
    let partStartIndex=0, partEndIndex=0;
    const parts=[];
    const ast={type:'Program'};

    const plugins={...config.plugins, ...pluginManager.default};

    const patterns={
        string: /[`"']/,
        comment: /\/\/|\/\*/,
        regexp: /(?<=[\=,\[\{\(;]\s*)\//
    };
    let pattern='';
    let scanRegexp=/(?<directive>(?<=^|\n[ \t]*)@)/g;
    if (config.scan) {
        config.scan.forEach(function (key) {
            const regexp=patterns[key];
            if (regexp) {
                if (pattern) {
                    pattern+='|';
                }
                pattern += `(?<${key}>${regexp.source})`;
            }
        });
        pattern+=`|${scanRegexp.source}`;
        scanRegexp=new RegExp(pattern, 'g');
    }

    const handler={
        done() {
            throw new Error();
        },
        catch(e) {
            if (e.message) {
                throw e;
            }
        },
        matchContent(regexp) {
            regexp.lastIndex=nextIndex;
            const result=regexp.exec(content)
            if (result) {
                index=result.index;
                nextIndex=regexp.lastIndex;
                return result;
            }
            return null;
        },
        matchAllContent(regexp, callback) {
            let result;
            while (result=this.matchContent(regexp)) {
                if (callback) {
                    callback(result);
                }
            }
        },
        skipBack(result) {
            nextIndex-=result[0].length;
        },
        skip(result) {
            nextIndex+=result[0].length;
        },
        walk(result, fn, args) {
            if (typeof(fn)==='string') {
                let key=fn;
                let visitorKey = `walk${key.substr(0, 1).toUpperCase()}${key.substr(1)}`;
                fn=visitor[visitorKey];
            }
            if (!fn) {
                return;
            }
            this.skipBack(result)
            if (!fn.call(this, args)) {
                this.skip(result);
            }
        },
        markStartPart() {
            partStartIndex=nextIndex;
            partEndIndex=nextIndex;
        },
        markEndPart() {
            partEndIndex=index;
            parts.push(content.substring(partStartIndex, partEndIndex));
        }
    };
    const visitor={
        walk() {
            let hit=false;
            handler.matchAllContent(scanRegexp, function (result) {
                const groups=result.groups;
                for (let key in groups) {
                    if (!groups[key]) {
                        continue;
                    }
                    handler.walk(result, key);
                    break;
                }
                hit=true;
            });
            return hit;
        },
        walkDirective() {
            const regexp=/@(?<name>\w+)/y;
            let result=handler.matchContent(regexp);
            if (result) {
                const groups=result.groups;

                let plugin=plugins[groups.name];
                if (!plugin) {
                    return false;
                }

                handler.markEndPart();

                const directive={
                    type: 'Directive',
                    name: groups.name,
                };
                ast.body=ast.body||[];
                ast.body.push(directive);

                directive.start=index;

                const parametersRexgexp=/\s*(?:;|(?<parameters>\()|(?<block>\{))/y;
                const parametersResult=handler.matchContent(parametersRexgexp);
                if (parametersResult) {
                    const parametersGroups=parametersResult.groups;
                    for (let key in parametersGroups) {
                        if (!parametersGroups[key]) {
                            continue;
                        }
                        handler.walk(parametersResult, key, directive);
                        break;
                    }
                }

                handler.markStartPart();

                directive.end=nextIndex;

                if (typeof(plugin)==='object') {
                    directive.compile=plugin.compile;
                    plugin=plugin.parse;
                }
                directive.parse=plugin;

                const pluginConfig = {
                    ast,
                    directive,
                    parentConfig: config
                };
                const pluginResult=plugin.call(self, file, pluginConfig);
                if (pluginResult) {
                    parts.push(pluginResult);
                }

                return true;
            }
            return false;
        },
        walkParameters(directive) {
            let depth=0;
            let hit=false;
            const regexp=/(\s*)(?:,|(?<add>\()|(?<sub>\))|(?<string>['`"])|(?<number>\d)|(?<null>null)|(?<comment>\/\*|\/\/)|(?<regexp>(?<=[\=,\[\{\(;]\s*)\/)|(?<eof>;))/y;
            handler.matchAllContent(regexp, function (result) {
                const space=result[1];
                if (space) {
                    nextIndex+=space.length;
                }
                const groups=result.groups;
                for (let key in groups) {
                    if (!groups[key]) {
                        continue;
                    }
                    switch (key) {
                        case 'add':
                            depth++;
                            break;
                        case 'sub':
                            depth--;
                            if (depth == 0) {
                                // 解析代码块
                                const blockRegexp = /\s*(?:;|(?<block>\{))/y;
                                const blockResult = handler.matchContent(blockRegexp);
                                if (blockResult) {
                                    const blockGroups = blockResult.groups;
                                    for (let key in blockGroups) {
                                        if (!blockGroups[key]) {
                                            continue;
                                        }
                                        handler.walk(blockResult, key, directive);
                                        break;
                                    }
                                }
                                return true;
                            }
                            break;
                        case 'eof':
                            if (depth > 0) {
                                return true;
                            }
                            break;
                        default:
                            handler.walk(result, key, directive);
                    }
                    break;
                }
                hit=true;
            });
            return hit;
        },
        walkBlock(directive) {
            let depth=0;
            const regexp=/\s*(?:(?<add>\{)|(?<sub>\}))/g;
            let blockStart,blockEnd;
            handler.matchAllContent(regexp, function (result) {
                const groups=result.groups;
                for (let key in groups) {
                    if (!groups[key]) {
                        continue;
                    }
                    switch (key) {
                        case 'add':
                            depth++;
                            if (depth==1) {
                                blockStart=nextIndex;
                            }
                            break;
                        case 'sub':
                            depth--;
                            if (depth == 0) {
                                blockEnd=nextIndex-1;
                                if (directive) {
                                    let block = content.substring(blockStart, blockEnd);
                                    // 解析block
                                    const blockPlugins=pluginManager.directive;
                                    const jsCompiler=require('./js-compiler');
                                    const blockResult = jsCompiler(null, block, {
                                        plugins: blockPlugins
                                    });
                                    directive.directives = blockResult.ast.body;
                                    block = blockResult.code;

                                    directive.block = block;
                                }

                                return true;
                            }
                    }
                    break;
                }
            });
            return false;
        },
        walkString(directive) {
            const regexp=/(?<string>(?<s>['"`])[^]*?(?<!\\)\k<s>)/y;
            const result=handler.matchContent(regexp);
            if (result) {
                const groups=result.groups;
                if (directive) {
                    directive.params = directive.params || [];
                    directive.params.push(eval(groups.string));
                }
                return true;
            }
            return false;
        },
        walkNumber(directive) {
            const regexp=/(?<number>\d[\d\.]*)/y;
            const result=handler.matchContent(regexp);
            if (result) {
                const groups=result.groups;
                if (directive) {
                    directive.params = directive.params || [];
                    directive.params.push(eval(groups.number));
                }
                return true;
            }
            return false;
        },
        walkNull(directive) {
            if (directive) {
                directive.params = directive.params || [];
                directive.params.push(null);
            }
            return false;
        },
        walkComment(directive) {
            const regexp=/(\/\*[^]*?\*\/)|(\/\/[^]*?\n)/y;
            const result=handler.matchContent(regexp);
            if (result) {
                return true;
            } else {
                handler.done();
                return false;
            }
        },
        walkRegexp(directive) {
            const regexp=/(?<=[\=,\[\{\(;]\s*)(?<regexp>\/[^]+?(?<!\\)\/(?<flags>\w+)?)/y;
            const result=handler.matchContent(regexp);
            if (result) {
                const groups=result.groups;
                if (directive) {
                    directive.params = directive.params || [];
                    directive.params.push(eval(groups.number));
                }
                return true;
            }
            return false;
        },
    };

    try {
        visitor.walk();
    } catch (e) {
        if (e.message) {
            throw e;
        }
    }
    parts.push(content.substring(partStartIndex));

    return {
        ast,
        code: parts.join('')
    };
};
module.exports=compiler;
