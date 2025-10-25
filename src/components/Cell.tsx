import React, { useState, useEffect } from "react";
import { useSpreadsheet } from "../context/SpreadsheetContext";
import evaluateFormula from "../utils/evaluator";
import type { CellData } from "../context/SpreadsheetContext";
import { updateDependencies , hasCycle } from '../utils/dependencyGraph'
import { extractReferences } from "../utils/evaluator";

type CellProps = { 
    row: number; 
    col: number 
};

export const Cell: React.FC<CellProps> = ({ row, col }) => {
    const id = `${String.fromCharCode(65 + col)}${row + 1}`;
    const [editing, setEditing] = useState(false);
    const { state, selectCell, updateCell, selectedCell } = useSpreadsheet();
    const cellData = state[id] || {raw: '', value: ''};
    const [inputValue, setInputValue] = useState(cellData.raw);

    useEffect(() => {
        setInputValue(cellData.raw);
    }, [cellData.raw]);

    const isSelected = selectedCell?.id === id;

    const clickHandler = () => {
        selectCell({ row, col, id });
    }
    
    const doubleClickHandler = () => {
        selectCell({ row, col, id });
        setEditing(true);
    }

    const blurHandler = () => {
        setEditing(false);

        const raw = inputValue.trim();
        let newData: CellData;

        const dependencies = extractReferences(raw)
        updateDependencies(id, dependencies)

        if (hasCycle(id)) {
            newData = { raw: raw, value: '#CYCLE!', error: '#CYCLE!'};
            updateCell(id, newData);
            return ;
        }

        if(raw.startsWith('=')) {
            try {
                const evaluated = evaluateFormula(raw, (id) => {
                    if(state[id].error === '#REF!') {
                        return "#REF!"
                    } else if (!state[id]) {
                        return "#VALUE!"
                    }
                    return state[id].value ?? '';
                });
                console.log(evaluated)
                if ('error' in evaluated){
                    newData = { raw: raw, value: evaluated.error, error: evaluated.error}
                } else {
                    newData = { raw: raw, value: evaluated.value.toString(), error: undefined }
                }
            } catch(e){
                newData = { raw: raw, value: '#ERROR', error: e instanceof Error ? e.message : String(e) };
            }
        } else {
            newData = { raw: raw, value: raw, error: undefined };
        }
        updateCell(id, newData)
        console.log(newData) // debugging purposes
    }

    const changeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    }

    const keyDownHandler = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter'){
            e.currentTarget.blur();
        }
    }

    return (
    <div
        className={`w-24 h-8 border-b border-r flex items-center justify-center text-sm ${
        isSelected ? "bg-green-500" : "bg-gray"
        }`}
        onClick={clickHandler}
        onDoubleClick={doubleClickHandler}
    >
        {editing ? (
        <input
            autoFocus
            value={inputValue}
            onChange={changeHandler}
            className="w-full h-full text-center outline-none bg-green-300"
            onKeyDown={keyDownHandler}
            onBlur={blurHandler}
        />
        ) : (
        <span>{cellData.value || ''}</span>
        )}
    </div>
    );
};
