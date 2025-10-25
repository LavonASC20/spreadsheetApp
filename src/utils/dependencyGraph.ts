export type NodeDependencies = {
    dependsOn: Set<string>;
    dependents: Set<string>;
};

const dependencyGraph = new Map<string, NodeDependencies>();

function nodeExists(cellId: string): NodeDependencies {
    if (!dependencyGraph.has(cellId)) {
        dependencyGraph.set(
            cellId, 
            { 
                dependsOn: new Set(), 
                dependents: new Set()
            });
    } 
    return dependencyGraph.get(cellId)!;
}

export function updateDependencies(cellId: string, newDependencies: string[]) {
    const node = nodeExists(cellId);

    // remove old dependencies
    for (const oldDependency of node.dependsOn) {
        const depNode = nodeExists(oldDependency);
        depNode.dependents.delete(cellId);
    }

    node.dependsOn = new Set(newDependencies)

    // add new dependencies
    for (const newDependency of newDependencies) {
        const depNode = nodeExists(newDependency);
        depNode.dependents.add(cellId)
    }
}

export function getDependents(cellId: string): Set<string> {
    // dfs search for dependents
    const visited = new Set<string>();
    const stack = [cellId];

    while (stack.length > 0){
        const curr = stack.pop() as string;
        if (visited.has(curr)) {
            continue;
        }
        visited.add(curr)

        const dependents = dependencyGraph.get(curr)?.dependents ?? new Set();
        for (const d of dependents) {
            stack.push(d)
        }
    }
    visited.delete(cellId);
    return visited;
}

export function hasCycle(startId: string): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    function dfs(cellId: string): boolean {
        if (stack.has(cellId)){
            return true;
        }
        if (visited.has(cellId)){
            return false;
        }

        visited.add(cellId)
        stack.add(cellId)

        const dependencies = dependencyGraph.get(cellId)?.dependsOn ?? new Set();
        for (const d of dependencies) {
            if (dfs(d)) {
                return true;
            }
        }

        stack.delete(cellId);
        return false;
    }
    return dfs(startId)
}

export function deleteCellFromGraph(cellId: string) {
    const node = dependencyGraph.get(cellId);
    if(!node) {
        return ;
    }

    // remove from dependsOn
    for (const d of node.dependsOn) {
        const depNode = dependencyGraph.get(d);
        depNode?.dependents.delete(cellId);
    }
    // remove from dependents
    for (const d of node.dependents){
        const depNode = dependencyGraph.get(d);
        depNode?.dependsOn.delete(cellId);
    }
    // remove node itself
    dependencyGraph.delete(cellId);
}

export function getInvalidDependents(deletedIds: string[]) {
        const invalidating = new Set<string>();
        // find dependents recursively
        for (const id of deletedIds) {
            const dependents = getDependents(id);
            for (const d of dependents) {
                invalidating.add(d);
            } 
        }
        return invalidating;
    }

export function viewGraph(): Record<string, string[][]> {
    const view: Record<string, string[][]> = {};
    for (const [id, { dependsOn, dependents }] of dependencyGraph.entries()) {
        view[id] = [Array.from(dependsOn), Array.from(dependents)]
    }
    return view;
}

export { dependencyGraph }