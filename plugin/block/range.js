const blockUtils=require('./utils');

function parse(file, {directive, parentConfig}) {
    if (!directive.params || directive.params.length<3) {
        throw new SyntaxError(`@range miss params!`);
    }
}

function compile(directive, url, content, config) {
    const [start, end, replaceString]=directive.params;

    const range=blockUtils.originalRange(start, end, config);

    const code=content.substring(0, range.start)+replaceString+content.substring(range.end);

    blockUtils.modifyRange(content, start, end, replaceString, config);

    return code;
}

module.exports={
    parse,
    compile
}
