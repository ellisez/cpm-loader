function parse(file, {directive, parentConfig}) {
    if (!directive.params || directive.params.length<2) {
        throw new SyntaxError(`@component miss params!`);
    }
}
function compile(directive, url, content, config) {
    const [from, to]=directive.params;
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

module.exports={
    parse,
    compile
}
