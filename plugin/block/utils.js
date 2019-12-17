function originalRange(start, end, config) {
    if (config.rangOffset) {
        let offset=0;
        config.rangOffset.map(function (item) {
            if (start>item.index) {
                offset+=item.offset;
            }
        });
        start+=offset;
        end+=offset;
    }

    return {
        start,
        end
    }
}
function lineNumber(string) {
    let number=0;
    if (string==='') {
        number=1;
    } else {
        string.replace(/(^|\n)[^\n]*/g, function () {
            number++;
        });
    }
    return number;
}
function modifyRange(content, start, end, replaceString, config) {
    // 原来多少行，后来多少行
    let number=lineNumber(replaceString);

    const rawString=content.substring(start, end);
    let line=0, rawNumber=1;
    let regexp=/(^|\n)[^\n]*/g, result;
    while(result=regexp.exec(content)) {
        if (result.index>=start && result.index<=end) {
            rawNumber++;
            continue;
        } else if (result.index>end) {
            break;
        }
        line++;
    }

    // 修改行
    let offsetLine=rawNumber-number;
    if (offsetLine!=0) {
        config.lineOffset = config.lineOffset || [];
        config.lineOffset.push({
            line,
            offset: offsetLine
        });
    }

    // 修改范围
    let offsetRange=replaceString.length - (end - start);
    if (offsetRange!=0) {
        config.rangOffset = config.rangOffset || [];
        config.rangOffset.push({
            index: end,
            offset: offsetRange
        })
    }
}
function originalLine(line, config) {
    if (config.lineOffset) {
        let offset=0;
        config.lineOffset.map(function (item) {
            if (line>item.line) {
                offset+=item.offset;
            }
        });
        line+=offset;
    }

    return line;
}
function modifyLine(line, replaceString, index, rawString, config) {
    let number=lineNumber(replaceString);
    // 修改行
    let offsetLine=number-1;
    if (offsetLine!=0) {
        config.lineOffset = config.lineOffset || [];
        config.lineOffset.push({
            line,
            offset: offsetLine
        });
    }
    // 修改范围
    let offsetRange=replaceString.length-rawString.length;
    if (offsetRange!=0) {
        config.rangOffset = config.rangOffset || [];
        config.rangOffset.push({
            index: index + rawString.length,
            offset: offsetRange
        })
    }
}
module.exports={
    originalRange,
    modifyRange,
    originalLine,
    modifyLine,
    lineNumber
}
