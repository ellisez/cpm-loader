const blockUtils=require('./utils');

function parse(file, {directive, parentConfig}) {
    if (!directive.params || directive.params.length<2) {
        throw new SyntaxError(`@line miss params!`);
    }
}
function compile(directive, url, content, config) {
    const [ rawLine, replaceString ]=directive.params;
    let line=blockUtils.originalLine(rawLine, config);
    const regexp=/(^|\n)[^\n]*/g;
    let result;
    let count=0;
    return content.replace(regexp, function (rawString, enter, index, code) {
        count++;
        if (count==line) {
            blockUtils.modifyLine(line, replaceString, index, rawString, config);
            return enter+replaceString;
        }
        return rawString;
    });
}

module.exports={
    parse,
    compile
}
