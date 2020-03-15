const path=require('path');
const fs=require('fs');
const { SyncHook } = require('tapable');

class CpmPlugin {
    constructor(options) {
        this.options=options;
        const cwd=process.env.CPM_DIRECTOR || process.cwd();
        this.cacheRuntime=path.resolve(cwd, '.cpmrc');
        this.load();
    }

    load() {
        this.data={};
    }

    write(update) {
        function mergeContainer(container, updateContainer) {
            for (let i=0; i<updateContainer.length; i++) {
                const updateComponent=updateContainer[i];
                let hit=false;
                for (let j=0; j<container.length; j++) {
                    const component=container[j];
                    if (updateComponent.name==component.name) {
                        mergeComponent(component, updateComponent);
                        hit=true;
                        break;
                    }
                }
                if (!hit) {
                    container.push(updateComponent);
                }
            }
        }
        function mergeComponent(component, updateComponent) {
            for (let file in updateComponent.sources) {
                const sources=component.sources[file];
                const updateSources=updateComponent.sources[file];
                component.sources[file]=updateSources;
                // if (sources) {
                //     mergeSources(sources, updateSources);
                // } else {
                //     component.sources[file]=updateSources;
                // }
            }

        }
        function mergeSources(sources, updateSources) {
            for (let i=0; i<updateSources.length; i++) {
                const updateItem=updateSources[i];
                for (let j=0; j<sources.length; j++) {
                    const sourceItem=sources[j];
                    if (updateItem.start==sourceItem.start &&
                        updateItem.end==sourceItem.end) {
                       continue;
                    } else {
                        sources.push(updateItem);
                        break;
                    }
                }
            }
        }

        for (let containerKey in update) {
            let container=this.data[containerKey];
            let updateContainer=update[containerKey];
            if (containerKey==='parent') {
                mergeComponent(container, updateContainer);
            } else {
                if (container && updateContainer) {
                    mergeContainer(container, updateContainer);
                } else if (updateContainer){
                    this.data[containerKey]=updateContainer;
                }
            }

        }
    }

    save() {
        try {
            let code=JSON.stringify(this.data, null, '\t');
            fs.writeFileSync(this.cacheRuntime, code);
        } catch (e) {

        }
    }

    remove() {
        try {
            fs.unlinkSync(this.cacheRuntime);
        } catch (e) {

        }
    }

    apply(compiler) {
        const self=this;

        compiler.hooks.CpmComponent=new SyncHook(['data']);

        compiler.hooks.CpmComponent.tap(
            'updateCPMData', function (data, callback) {
            self.write(data);
        });
        compiler.hooks.done.tap(
            'saveCPMData', function(compilation) {
            self.save();
        });
    }
}
module.exports=CpmPlugin;
module.exports.default=CpmPlugin;
