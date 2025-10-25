import React, { useState, useEffect } from 'react';
import { useSpreadsheet } from '../context/SpreadsheetContext';
import evaluateFormula from '../utils/evaluator';
import { runScaleSmokeTest } from '../tests/smokeTest';

export const FormulaBar = () => {
    const { selectedCell, state, updateCell, deleteRow, deleteCol } = useSpreadsheet();
    const [inputValue, setInputValue] = useState('');
    const [deleteTarget, setDeleteTarget] = useState('');

    function getEvaluatedValue(id: string): string | number {
        const cell = state[id];
        if (!cell){
            return 0;
        }
        if (cell.error === "#REF!") {
            throw new Error("#REF!");
        } else if (!cell) {
            throw new Error("#VALUE!")
        }
        if(cell.raw.startsWith('=')){ // if the cell definition is itself a formula, recurse
            const res = evaluateFormula(cell.raw, getEvaluatedValue);
            if('error' in res){
                throw new Error(res.error);
            }
            return res.value;
        }
        return cell.value;
    }

    useEffect(() => {
        if (selectedCell) {
            const cellId = selectedCell.id;
            const cellData = state[cellId];
            setInputValue(cellData?.raw ?? '');
        } else {
            setInputValue('');
        }
    }, [selectedCell, state]);

    const changeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    }

    const keyDownHandler = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
        }
    }

    const commitHandler = () => {
        if (!selectedCell) {
            return ;
        }
        const cellId = selectedCell.id;
        const raw = inputValue.trim();

        let evalRes;

        try {
            if (raw.startsWith('=')) {
                const evaluated = evaluateFormula(raw, getEvaluatedValue);
                if ('error' in evaluated){
                    evalRes = { raw: raw, value: evaluated.error, error: evaluated.error}
                } else {
                    evalRes = { raw: raw, value: evaluated.value.toString(), error: undefined }
                }
            } else {
                evalRes = { raw: raw, value: raw, error: undefined }
            }
        } catch (e) {
            evalRes = { raw: raw, value: '#SYNTAX!', error: e instanceof Error? e.message : String(e)} 
        }

        updateCell(cellId, evalRes)
    }

    const deleteHandler = () => {
        const target = deleteTarget.trim().toUpperCase();

        if (!target) {
            alert('Please enter a row number or column letter to delete')
            return ;
        }

        if(/^[0-9]+$/.test(target)) { // row number
            const row = parseInt(target, 10)
            deleteRow(row);
        } else if (/^[A-Z]+$/.test(target)){ //column number
            let colNum = 0;
            for (let i = 0; i < target.length; i++){ // in case column is multilettered
                colNum = colNum*26 + target.charCodeAt(i) - 64
            }
            deleteCol(colNum);
        } else {
            alert('Invalid target row/column. Please enter a valid column leter or row number')
        }

        setDeleteTarget('');
    }

    const testHandler = async () => {
        console.log("Starting performance smoke test...")

        try{
            const results = await runScaleSmokeTest({
                log: true,
                scales: [10,100,1000,5000,10000],
                runsPerScale: 2
            });

            console.log('Test complete. Final Summary: ');
            console.log(results);
        } catch (e) {
            console.error('Testing failed, womp womp: ', e);
        }
    };

    return (
    <div className="flex items-center border-y bg-neutral-700 px-3 py-2">
        <span className="mr-2 font-mono text-sm text-gray-500">fx</span>
        <input
            type="text"
            value={inputValue}
            placeholder="Enter a value or formula "
            onChange={changeHandler}
            className="flex-1 outline-none border-none bg-transparent text-sm"
            onBlur={commitHandler}
            onKeyDown={keyDownHandler}
        />
        <input
            type="text"
            value={deleteTarget}
            onChange={(e) => setDeleteTarget(e.target.value.toUpperCase())}
            placeholder='Row (number) or Column (letter) to delete'
            className='border px-2 py-1 w-100 text-center'
        />
        <button
            onClick={deleteHandler}
            className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-red-600"
        >
            Delete
        </button>

        <button
            onClick={testHandler}
            className='bg-orange-500 text-white px-3 py-1 rounded hover:bg-red-600'
        >
            Magic Button
        </button>    
    </div>
    );
};
