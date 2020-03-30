const path=require('path');
const fs=require('fs');
const probe=require('./probe');

class CpmPlugin {
    constructor(options) {
        this.options=options;
        probe.removeData();
    }

    apply(compiler) {
        const self=this;

        compiler.hooks.done.tap(
            'saveCPMData', function(compilation) {
                probe.saveData();
        });
    }
}
module.exports=CpmPlugin;
module.exports.default=CpmPlugin;
