const babel=require('@babel/core');
const path=require('path');
const fs=require('fs');

const cwd=process.env.CPM_DIRECTOR || process.cwd();

function babelCompile(code, options) {
    const babelConfig=babel.loadPartialConfig(options);
    return babel.transform(code, babelConfig.options);
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

function resolvePath(loaderContext, basepath, request) {
    if (!loaderContext.resolve || !loaderContext.async) {
        throw new ReferenceError('not a loaderContext!');
    }
    if (!request) {
        request=basepath;
        basepath=loaderContext.context;
    }
    if (loaderContext.resolveSync) {
        try {
            return loaderContext.resolveSync(basepath, request);
        } catch (e) {
            return null;
        }
    }
    let resultPath=null;
    (async () => {
        resultPath=await new Promise((resolve, reject) => {
            loaderContext.resolve(basepath, request, function (err, result) {
                if (err) {
                    reject(err);
                }
                resolve(result);
            })
        }).catch(() => null);
    })();
    return resultPath;
}

function relativePath(url, currentDir) {
    currentDir=currentDir||cwd;
    return path.relative(currentDir, url).replace(/\\/g, '/');
}

function readPkg(name) {
    let pkgPath;
    if (name) {
        pkgPath=path.resolve(cwd, './node_modules/', name, 'package.json');
    } else {
        pkgPath=path.resolve(cwd, 'package.json');
    }
    return require(pkgPath);
}

function inProject(file) {
    const cpmNativeDirector=process.env.CPM_NATIVE_DIRECTOR;
    if (file.startsWith(path.join(cwd, 'src')) ||
        (cpmNativeDirector &&
            file.startsWith(path.join(cpmNativeDirector, 'src')))) {
        // 只支持src和native下的src
        return true;
    }
    return false;
}
module.exports={
    resolvePath,
    relativePath,
    readPkg,
    babelCompile,
    nodeName,
    vuePartment,
    inProject
};
