const fs=require('fs');
const path=require('path');
const babel=require('babel-core');

function excludeRange(content) {
    let allRange=[];

    const allRegexp= [
        /(?<singleLineComment>\/\/[^\n]*(?<singleLineCommentBackspace>\n))/g,//单行注释
        /(?<multiLineComment>\/\*[^]*?\*\/)/g,//多行注释
        /(?<singleQuoteString>'(?:(?:\\'|[^'])*)?')/g,//单引号字符串
        /(?<doubleQuotString>"(?:(?:\\"|[^"])*)?")/g,//双引号字符串
        /(?<backQuoteString>`(?:(?:\\`|[^`])*)?`)/g,//反引号字符串
        /(?<style>\<style\s[^]*?\<\/style\>)/g,//样式表
        /(?<regexpSpace>^|[^\.\w]\s*)(?<regexp>\/[^\n\/\*][^\n]*\/\w?)/g//正则表达式
    ];
    let pattern='';
    allRegexp.forEach(function(regexp) {
        if (pattern!='') pattern+='|';
        pattern+=regexp.source;
    });
    let regexp=new RegExp(pattern, 'g');
    let result;
    while (result=regexp.exec(content)) {
        let groups=result.groups;
        let offset=0;
        let backspace=0;
        for (let groupName in groups) {
            let groupString=groups[groupName];
            if (groupString) {
                if (/Space$/g.test(groupName)) {
                    offset=groupString.length;
                } else
                if (/Backspace$/g.test(groupName)) {
                    backspace=groupString.length;
                }
            }
        }
        allRange.push({
            start: result.index+offset,
            end: result.index+result[0].length-backspace
        });
    }
    return allRange;
}

function mappingRange(regexp, result, excludes, defaultRange) {
    let string=result[0];
    let offset=result.groups.space?result.groups.space.length:0;
    let backspace=result.groups.backspace?result.groups.backspace.length:0;

    let start=result.index+offset;
    let end=result.index+string.length-backspace;
    regexp.lastIndex=end;

    let raw=result.input.substring(start, end);

    if (excludes) {
        for (let i = 0; i < excludes.length; i++) {
            let exclude = excludes[i];
            if (start < exclude.start) {
                break;
            } else
            if (start < exclude.end) {
                return null;
            }
        }
    }
    if (defaultRange) {
        return { start:defaultRange.start, end:defaultRange.end, raw };
    }
    return { start, end, raw };
}

function sentence(regexp, data, handler) {
    let content, excludes, defaultRange;
    if (typeof(data)=='string') {
        content=data;
    } else if (data instanceof Array) {
        [content, excludes, defaultRange]=data;
    }
    let result;
    while(result=regexp.exec(content)) {
        let range=mappingRange(regexp, result, excludes, defaultRange);
        if (!range) {
            continue;
        }

        let response;
        if (typeof(handler)=='function') {
            response=handler.call(this, result, range);
        } else if (typeof(handler)=='object') {
            let options=handler.options;
            let _handler=handler.handler;
            response=_handler.call(this, result, range, options);
        }
        if (response===false) {
            break;
        }
    }
}

function replaceSentence(regexp, data, handler) {
    let content, excludes, defaultRange;
    if (typeof(data)=='string') {
        content=data;
    } else if (data instanceof Array) {
        [content, excludes, defaultRange]=data;
    }

    let self=this;
    let result;
    content=content.replace(regexp, function () {
        result=[...arguments].slice(0, -3);
        result.groups=arguments[arguments.length-1];
        result.input=arguments[arguments.length-2];
        result.index=arguments[arguments.length-3];
        let range=mappingRange(regexp, result, excludes, defaultRange);
        if (!range) {
            return result[0];
        }

        if (typeof(handler)=='function') {
            return handler.call(self, result, range);
        } else if (typeof(handler)=='object') {
            let options=handler.options;
            let _handler=handler.handler;
            return _handler.call(self, result, range, options);
        }
    });
    return content;
}

function commandSentence(command, data, handler) {
    let pattern='';
    if (typeof(command)=='string') {
        pattern=command.replace(/([\.\+\-\=\^\|\{\}\[\]\(\)\<\>\?\\])/g, '\\$1');
    } else
    if (typeof(command)=='object') {
        if (command instanceof RegExp) {
            pattern=command.source;
        } else {
            pattern=`(?<command>@${command.name})`;
            let allArgPattern='';
            if (command.arguments) {
                pattern+='\\s*\\(';
                command.arguments.forEach(function (arg) {
                    let argPattern='';
                    let typePattern = `(?<${arg.key}>.+)`;
                    if (arg.type instanceof RegExp) {
                        typePattern = `(?<${arg.key}>${arg.type.source})`;
                    } else if (arg.type == 'number') {
                        typePattern = `(?<${arg.key}>\\d+)`;
                    } else if (arg.type == 'string') {
                        typePattern = `['"\`](?<${arg.key}>.*)['"\`]`;
                    }
                    if (allArgPattern != '') argPattern += '\\s*,';
                    argPattern += `\\s*${typePattern}`;
                    if (arg.required===false) {
                        argPattern='(?:'+argPattern+')?';
                    }
                    allArgPattern += argPattern;
                });
                pattern+=allArgPattern+'\\s*\\)';
            }
        }
    }

    let spaceRegexp=/(?<space>^|\n)/g;
    let backspaceRegexp=/((?:\s*(?:;|(?<block>\{)))|(?<backspace>\s*[^;\{])|$)/g;

    let regexp=new RegExp(`${spaceRegexp.source}\\s*${pattern}${backspaceRegexp.source}`);

    let content, excludes, defaultRange;
    if (typeof(data)=='string') {
        content=data;
    } else if (data instanceof Array) {
        [content, defaultRange]=data;
    }

    let result;
    while(result=regexp.exec(content)) {
        excludes=excludeRange(content);
        let range=mappingRange(regexp, result, excludes, defaultRange);
        if (!range) {
            continue;
        }

        let groups=result.groups;
        if (groups.block) {
            let blockStart = range.end-groups.block.length;
            let blockRange = block([content, excludes], blockStart);
            if (!blockRange) {
                throw new Error(`${groups.command} parsing failed!`);
            }
            let blockCode=content.substring(blockRange.start, blockRange.end);
            groups.block=blockCode;
            range.end=blockStart+blockCode.length;
        }
        groups.code=content.substring(range.start, range.end);
        regexp.lastIndex = range.end;

        let response;
        if (typeof(handler)=='function') {
            response=handler.call(this, result, range);
        } else if (typeof(handler)=='object') {
            let options=handler.options;
            let _handler=handler.handler;
            response=_handler.call(this, result, range, options);
        }
        if (response==null) {
            break;
        } else {
            response=response||'';
            content=replaceRange(content, range, response);
            regexp.lastIndex=range.start+response.length;
        }
    }

    return content;
}

function replaceRange(content, range, newString) {
    let start,end;
    if (typeof(range)=='number') {
        start=end=range;
    } else if (typeof(range)=='object') {
        start=range.start;
        end=range.end;
    }

    return content.substring(0, start)+newString+content.substring(end);
}

function relativePath(url, baseurl) {
    let dirname;
    if (baseurl) {
        dirname=path.dirname(baseurl);
    } else {
        dirname=process.cwd();
    }
    return path.relative(dirname, url).replace(/\\/g, '/');
}

function relativePath(url, baseurl) {
    let dirname;
    if (baseurl) {
        dirname=path.dirname(baseurl);
    } else {
        dirname=process.cwd();
    }
    return path.relative(dirname, url).replace(/\\/g, '/');
}

function formatePath(url) {
    if (url) {
        return path.relative(process.cwd(), url).replace(/\\/g, '/');
    }
    return null;
}

// 读取alias替换路径
function aliasPath(url, config) {
    if (config && config.resolve && config.resolve.alias) {
        let alias=config.resolve.alias;
        for (let key in alias) {
            let regexp=new RegExp(`^${key}/`, 'g');
            let result=regexp.exec(url);
            if (result) {
                url=url.substring(result[0].length);
                url=path.resolve(alias[key], url);
                url=path.relative(process.cwd(), url);
                return url;
            }
        }
    }
    return null;
}

// 相对于root下的路径
function resolvePath(url, baseurl, config) {
    let result=resolveUrl(url, baseurl, config);
    if (result) {
        return path.relative(process.cwd(), result).replace(/\\/g, '/');
    }
    return null;
}

function resolveUrl(url, baseurl, config) {
    let dirname;
    if (baseurl) {
        dirname=path.dirname(baseurl);
    } else {
        dirname=process.cwd();
    }

    // alias
    let result=aliasPath(url, config);


    if (!result) {
        if (url.charAt(0) == '.') {
            // 相对路径
            result = path.resolve(dirname, url);
        } else {
            // cwd路径
            result=path.resolve(process.cwd(), 'node_modules', url);
        }
    }
    return result;
}

function importPath(url, baseurl, config) {
    let real = importUrl(url, baseurl, config);
    if (real)  {
        return path.relative(process.cwd(), real).replace(/\\/g, '/');
    }
    return null;
}

function importUrl(url, baseurl, config) {
    let result=resolveUrl(url, baseurl, config);

    // 当作真实路径加载
    if (fs.existsSync(result)) {
        if (fs.statSync(result).isFile()) {
            return result;
        } else {
            let packagejson = result+'/package.json';
            if (fs.existsSync(packagejson)) {
                const pkg=require(packagejson);
                return path.resolve(result, (pkg.main || 'index.js'));
            }
        }
    }

    // 补充路径
    const arr=[
        '.js', '.vue',
        '/index.js', '/index.vue'
    ];
    let basename=path.basename(url);
    if (basename){
        arr.push(`/${basename}.js`, `/${basename}.vue`);
    }
    for (let i=0;i<arr.length;i++) {
        let item=arr[i];
        let newResult=result+item;
        newResult=newResult.replace(/[\\]+/g,'/');
        if (fs.existsSync(newResult)) {
            return newResult;
        }
    }

    return null;
}

function sourceCode(url, baseurl, config) {
    let real = importUrl(url, baseurl, config);
    if (!real) {
        throw new Error(`${url} are not found!`);
    }
    const buffer=fs.readFileSync(real);
    const code = buffer.toString();
    return code;
}

function readPkg(name) {
    let pkgPath;
    if (name) {
        pkgPath=path.resolve(process.cwd(), './node_modules/', name, 'package.json');
    } else {
        pkgPath=path.resolve(process.cwd(), 'package.json');
    }
    return JSON.parse(fs.readFileSync(pkgPath));// 不缓存
}

function writePkg(name, json) {
    let pkgPath;
    let data=json;
    if (arguments.length>=2) {
        pkgPath=path.resolve(process.cwd(), './node_modules/', name, 'package.json');
    } else if(arguments.length==1) {
        data=name;
        pkgPath=path.resolve(process.cwd(), 'package.json');
    } else {
        return;
    }
    fs.writeFileSync(pkgPath, JSON.stringify(data, null, '\t'));
}

function compile(code, plugin) {
    let babelrc_path;
    let babelrc = {};
    try {
        babelrc_path = path.resolve(process.cwd(), './.babelrc');
        let json = fs.readFileSync(babelrc_path);
        json = json.toString();
        babelrc = eval('(' + json + ')');
    } catch (e) {
        console.log(`${babelrc_path} is invalid!`);
    }

    babelrc.plugins.push(plugin);
    return babel.transform(code, babelrc);
}

function block([content, excludes], index=0) {
    let depth=0;
    let result, regexp;
    regexp=/\S/g;
    regexp.lastIndex=index;
    if (result=regexp.exec(content)) {
        if (['{','[','('].indexOf(result[0])==-1) {
            return null;
        }
    }

    regexp=/(?<open>[\(\[\{])|(?:(?<close>[\)\]\}])(\s*;)?)/g;
    regexp.lastIndex=index;

    let allBracket={
        '{':'}',
        '[':']',
        '(':')'
    };

    let response,bracket;
    try {
        sentence(regexp, [content, excludes], function (result, range) {
            let string = result[0];
            let {open, close} = result.groups;
            if (open) {
                if (depth == 0) {
                    bracket = open;
                    depth = 1;
                } else if (depth > 0 && open == bracket) {
                    ++depth;
                }
            } else
            if (close){
                if (!bracket) {
                    response=null;
                    throw new Error('break');
                }
                if (close.indexOf(allBracket[bracket])==0) {
                    --depth;
                    if (depth == 0) {
                        bracket=null;
                        response={
                            start: index,
                            end: range.end
                        };
                        throw new Error('break');
                    }
                }
            }
        });
    } catch (e) {
        if (e.message=='break') {
            return response;
        } else {
            throw e;
        }
    }
    return null;

}

function equalArray(array1, array2) {
    if (array1.length==array2.length) {
        return JSON.stringify(array1.sort())==JSON.stringify(array2.sort());
    }
    return false;
}

function declaration(node) {
    let names=[];
    switch (node.type) {
        case 'VariableDeclaration':
            if (!node.declarations) {
                break;
            }
            node.declarations.forEach(function (declaration) {
                names.push(declaration.id.name);
            });
            break;
        case 'FunctionDeclaration':
            if (!node.id) {
                break;
            }
            names.push(node.id.name);
            break;
        case 'ImportDeclaration':
            if (!node.specifiers) {
                break;
            }
            node.specifiers.forEach(function (specifier) {
                names.push(specifier.local.name);
            });
            break;
        case 'ExportNamedDeclaration':
            if (!node.declaration || !node.declaration.declarations) {
                break;
            }
            node.declaration.declarations.forEach(function (declaration) {
                names.push(declaration.id.name);
            });
            break;
        case 'ExportDefaultDeclaration':
            names.push('default');
            break;
    }
    return names;
}

function webpackConfig() {
    try {
        let configPath=path.resolve(process.cwd(), 'build/webpack.base.conf.js');
        return require(configPath);
    } catch (e) {

    }

}

module.exports={
    excludeRange,
    mappingRange,
    sentence,
    replaceSentence,
    replaceRange,
    resolveUrl,
    resolvePath,
    importUrl,
    importPath,
    formatePath,
    aliasPath,
    relativePath,
    sourceCode,
    readPkg,
    writePkg,
    block,
    compile,
    commandSentence,
    declaration,
    equalArray,
    webpackConfig
}