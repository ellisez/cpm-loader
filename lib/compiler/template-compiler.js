const compiler=require('./compiler');

module.exports=function (file, content, config) {
    const self=this;
    let result=compiler.call(self, file, content, config);

    let needModifyAst=false;
    if (config && config.components && Object.keys(config.components).length>0) {
        needModifyAst=true;
    }

    if (!needModifyAst) {
        return { code:content };
    }

    const options= {
        video: ['src', 'poster'],
        source: 'src',
        img: 'src',
        image: ['xlink:href', 'href']
    };
    let pattern ='';
    for (let key in options) {
        let value=options[key];
        if (pattern) {
            pattern+='|';
        }
        let valuePattern=value;
        if (value instanceof Array) {
            valuePattern=value.join('|');
        }
        // <video src="">
        // <video poster=""/>
        pattern+=`(?<${key}>\\<${key}\\s.*?(?:${valuePattern}))`;
    }
    pattern=`(?<pre>(?:${pattern})\s*=\\s*(?<s>["']))(?<url>.*?)(?<suf>\\k<s>.*?\\/?\>)`;
    const scanRegexp=new RegExp(pattern, 'g');

    let code=content;
    const visitor={
        walk() {
            code=content.replace(scanRegexp, function(rawString) {
                const groups=arguments[arguments.length-1];
                const url=groups.url;
                if (url && config.components[url]) {
                    let newUrl=config.components[url];
                    if (newUrl) {
                        return groups.pre + newUrl + groups.suf;
                    }
                }
                return rawString;
            });
        }
    }

    visitor.walk();

    return {code};
}
