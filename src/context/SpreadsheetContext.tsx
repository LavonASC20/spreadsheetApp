import { createContext, useContext, useReducer, type ReactNode, useEffect, useRef } from 'react';
import { deleteCellFromGraph, getInvalidDependents } from '../utils/dependencyGraph';

const STORAGE_KEY = 'spreadsheet_state';

export type CellData = {
    raw: string;
    value: string;
    error?: string;
}

export type SpreadsheetState = {
    [cellId: string]: CellData ;
}

export type SelectedCell = {
    row: number;
    col: number;
    id: string;
}

type SpreadsheetContextType = {
    state: SpreadsheetState;
    selectedCell: SelectedCell | null;
    selectCell: (cell: SelectedCell) => void;
    updateCell: (cellId: string, data: CellData) => void;
    deleteRow: (rowNum: number) => void;
    deleteCol: (colNum: number) => void;
}

const SpreadsheetContext = createContext<SpreadsheetContextType | undefined>(undefined);

type Action = | { type: "SELECT_CELL"; cell: SelectedCell }
              | { type: "UPDATE_CELL"; cellId: string; data: CellData }
              | { type: "DELETE_CELL"; cellIds: string[] };

type SpreadsheetReducerState = {
    state: SpreadsheetState;
    selectedCell: SelectedCell | null;
};

const spreadsheetReducer = (
    currState: SpreadsheetReducerState,
    action: Action,
): SpreadsheetReducerState => {
    switch (action.type) { 
        case "SELECT_CELL":
            return { ...currState, selectedCell: action.cell };
        case "UPDATE_CELL": {
            const { cellId, data } = action;
            return {
                ...currState,
                state: {
                    ...currState.state,
                    [cellId]: {...currState.state[cellId], ...data}
                }
            }
        }
        case "DELETE_CELL": {
            const newState = { ...currState.state };
            for (const id of action.cellIds) {
                delete newState[id];
            }
            return { ...currState, state: newState };
        }
        default: 
            return currState;
    }
};

function loadFromLocalStorage(): SpreadsheetState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if(!raw) {
            return {};
        }
        const parsed = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null){
            return {};
        }
        return parsed
    } catch (e) {
        console.error('Failed to load data from localStorage: ', e)
        return {};
    }
}

function saveToLocalStorage(state: SpreadsheetState) {
    try{
        const nonEmpty: SpreadsheetState = {};
        for (const [id, cell] of Object.entries(state)){
            if(cell.raw?.trim()) {
                nonEmpty[id] = cell;
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nonEmpty))
    } catch(e) {
        console.error("Failed to save data to localStorage: ", e)
    }
}

export const SpreadsheetProvider = ({ children }: { children: ReactNode }) => {
    const dataInit = loadFromLocalStorage();
    const [state, dispatch] = useReducer(spreadsheetReducer, {
        state: dataInit, 
        selectedCell: null 
    });

    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (saveTimeout.current) {
            clearTimeout(saveTimeout.current);
        }
        saveTimeout.current = setTimeout(() => {
            saveToLocalStorage(state.state);
        }, 400);
    }, [state.state])
    
    const selectCell = ( cell: SelectedCell ) => {
        dispatch({ type: "SELECT_CELL", cell });
    } 

    const updateCell = ( cellId: string, data: CellData ) => {
        dispatch({ type: "UPDATE_CELL", cellId, data });
    }

    function idxToCol(idx: number): string {
        let n = idx;
        let col = '';

        while (n > 0) {
            const rem = (n-1)%26;
            col = String.fromCharCode(65+rem) + col;
            n = Math.floor((n-1)/26)
        }
        return col
    }

    const invalidateDependents = (deletedIds: string[]) => {
        const dependents = getInvalidDependents(deletedIds);

        for (const depId of dependents) {
            updateCell(depId, {
                raw: state.state[depId]?.raw ?? '',
                value: "#REF!",
                error: "#REF!"
            })
        }
    }

    const deleteRow = (rowNum: number) => {
        const cells = Object.keys(state.state);
        const deleting: string[] = [];

        for (const cellId of cells){
            const match = cellId.match(/^([A-Z]+)([0-9]+)$/)
            if(!match){
                continue;
            }
            // match[2] is the second capture group, the row digits
            const row = parseInt(match[2], 10);
            if (row === rowNum){
                deleting.push(cellId);
                deleteCellFromGraph(cellId);
            }
        }
        dispatch({ type: "DELETE_CELL", cellIds: deleting });
        invalidateDependents(deleting);
    }

    const deleteCol = (colNum: number) => {
        const colName = idxToCol(colNum)
        const cells = Object.keys(state.state);
        const deleting: string[] = [];

        for (const cellId of cells){
            const match = cellId.match(/^([A-Z]+)([0-9]+)$/)
            if(!match){
                continue;
            }
            // match[1] is the first capture group, the column letters
            const col = match[1];
            if (col === colName){
                deleting.push(cellId)
                deleteCellFromGraph(cellId);
            }
        }
        dispatch({ type: "DELETE_CELL", cellIds: deleting });
        invalidateDependents(deleting);
    }

    return (
        <SpreadsheetContext.Provider
            value = {{ 
                state: state.state, 
                selectedCell: state.selectedCell,
                selectCell, 
                updateCell,
                deleteRow,
                deleteCol
            }}>
            { children }
        </SpreadsheetContext.Provider>
    )
}
// eslint-disable-next-line react-refresh/only-export-components
export const useSpreadsheet = () => {
    const context = useContext(SpreadsheetContext);
    if (!context){
        throw new Error('use useSpreadsheet within a SpreadsheetProvider')
    }
    return context
}