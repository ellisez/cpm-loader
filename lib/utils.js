const babel=require('babel-core');
const path=require('path');
const fs=require('fs');

function _loadBabelOptions() {
    let babelOptions={};
    let babelrcPath = path.resolve(process.cwd(), './.babelrc');
    try {
        let json = fs.readFileSync(babelrcPath);
        json = json.toString();
        babelOptions = eval('(' + json + ')');
    } catch (e) {debugger;
        console.log(`${babelrcPath} is invalid!`);
    }
    return babelOptions;
}
const babelOptions=_loadBabelOptions();

function loadBabelOptions() {
    return JSON.parse(JSON.stringify(babelOptions));
}

function _loadWebpakOptions() {
    let webpackPath = path.resolve(process.cwd(), 'build/webpack.base.conf.js');
    try {
        return require(webpackPath);
    } catch (e) {debugger;
        console.log(`${webpackPath} is invalid!`);
    }
    return {};
}
const webpakOptions=_loadWebpakOptions();

function loadWebpakOptions() {
    return JSON.parse(JSON.stringify(webpakOptions));
}

function babelCompile(code, plugin) {
    const copyBabelOptions=loadBabelOptions();
    copyBabelOptions.plugins=copyBabelOptions.plugins||[];
    copyBabelOptions.plugins.push(plugin);
    return babel.transform(code, copyBabelOptions);
}
function nodeName(node) {
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
function mergerComplilerConfig(one, other) {
    let scan=[];
    if (one && one.scan) scan.push(...one.scan);
    if (other && other.scan) scan.push(...other.scan);
    return {
        ...one, ...other,
        scan
    }
}
function vuePartment(content) {
    function elementAttrs(html, object) {
        const regexp=/\s*(?<name>\w+)\s*=\s*(?<s>["'])(?<value>.*?)\k<s>/g;
        let result;
        while(result=regexp.exec(html)) {
            const groups=result.groups;
            object[groups.name]=groups.value;
        }
    }
    const parts={};
    const templateRegexp=/(?<=(?:^|\n)\<template(?<templateAttrs>\s[^]*?)?\>)(?<template>[^]*?)(?=\n\<\/template\>)/g;
    const scriptRegexp=/(?<=(?:^|\n)\<script(?<scriptAttrs>\s[^]*?)?\>)(?<script>[^]*?)(?=\n\<\/script\>)/g;
    const styleRegexp=/(?<=(?:^|\n)\<style(?<styleAttrs>\s[^]*?)?\>)(?<style>[^]*?)(?=\n\<\/style\>)/g;
    const regexp=new RegExp(`${templateRegexp.source}|${scriptRegexp.source}|${styleRegexp.source}`, 'g');
    let result;
    while (result=regexp.exec(content)) {
        const groups=result.groups;
        const attrs={};
        if (groups.template) {
            parts.template={
                attrs,
                content: groups.template,
                start: result.index,
                end: regexp.lastIndex
            }
            elementAttrs(groups.templateAttrs, attrs);
        } else
        if (groups.script) {
            parts.script = {
                attrs,
                content: groups.script,
                start: result.index,
                end: regexp.lastIndex
            }
            elementAttrs(groups.scriptAttrs, attrs);
        } else
        if (groups.style) {
            parts.styles=parts.styles||[];
            parts.styles.push({
                attrs,
                content: groups.style,
                start: result.index,
                end: regexp.lastIndex
            })
            elementAttrs(groups.styleAttrs, attrs);
        }
    }
    return parts;
}

// 读取alias替换路径
function aliasPath(url) {
    const config=loadWebpakOptions();
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
// 解析路径
function resolvePath(url, currentDir) {
    currentDir=currentDir||process.cwd();
    // alias
    let result=aliasPath(url);


    if (!result) {
        if (url.charAt(0) == '.') {
            // 相对路径
            result = path.resolve(currentDir, url);
        } else {
            // cwd路径
            result=path.resolve(process.cwd(), 'node_modules', url);
        }
    }
    return result;
}
// 探测路径
function realPath(url, currentDir) {
    let result=resolvePath(url, currentDir);

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

function relativePath(url, currentDir) {
    currentDir=currentDir||process.cwd();
    return path.relative(currentDir, url).replace(/\\/g, '/');
}

function readPkg(name) {
    let pkgPath;
    if (name) {
        pkgPath=path.resolve(process.cwd(), './node_modules/', name, 'package.json');
    } else {
        pkgPath=path.resolve(process.cwd(), 'package.json');
    }
    return require(pkgPath);
}
function copyProperty(data) {
    return JSON.parse(JSON.stringify(data));
}
module.exports={
    realPath,
    resolvePath,
    relativePath,
    readPkg,
    copyProperty,
    babelCompile,
    nodeName,
    mergerComplilerConfig,
    vuePartment
};
