const path=require('path');
const fs=require('fs');

const cwd=process.env.CPM_DIRECTOR || process.cwd();

const filename = path.resolve(cwd, '.cpmrc');

function loadData() {
    try {
        const buffer=fs.readFileSync(filename);
        if (buffer) {
            return JSON.parse(buffer);
        }
    } catch (e) {

    }
    return {};
}


function updateData(update) {
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

    const data=loadData();
    for (let containerKey in update) {
        let container=data[containerKey];
        let updateContainer=update[containerKey];
        if (containerKey==='parent') {
            mergeComponent(container, updateContainer);
        } else {
            if (container && updateContainer) {
                mergeContainer(container, updateContainer);
            } else if (updateContainer){
                data[containerKey]=updateContainer;
            }
        }
    }
    saveData(data);
}

function saveData(data) {
    try {
        let code=JSON.stringify(data, null, '\t');
        fs.writeFileSync(filename, code);
    } catch (e) {

    }
}

function removeData() {
    try {
        fs.unlinkSync(filename);
    } catch (e) {

    }
}

module.exports = {
    loadData,
    updateData,
    saveData,
    removeData
}