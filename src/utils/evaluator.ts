export type EvalResult =
    | {value: number | string}
    | {error: string}

// helper functions, main export is at the bottom 

function tokenize(expr: string): string[] {
    // regex forms:
    // cell ref, range, number, operation, parenthesis, 
    // function, comma
    const regex = 
        /([A-Z]+[0-9]+)|([A-Z]+[0-9]+:[A-Z]+[0-9]+)|[0-9]+(\.[0-9]+)?|[+\-*/(),]|SUM|AVG/g;
    const tokens = expr.match(regex);
    if (!tokens) {
        throw new Error('#VALUE!')
    }
    return tokens ?? [];
}

function replaceTokens(
    tokens: string[], 
    getValue: (cellId: string) => string | number | null
): string {
    const output: string[] = [];
    let i = 0;

    while(i < tokens.length){
        const t = tokens[i];
        const rawVal = getValue(t);
        console.log(`token: ${t}    getValue: ${rawVal}`);

        // handle functions
        if(t === 'SUM' || t === 'AVG'){
            const func = t;
            if(tokens[i+1] !== '(') {
                throw new Error('#SYNTAX!');
            }  
            const { args, nextIdx } = parseArgs(tokens, i+2);
            const vals: number[] = [];

            for(const arg of args){
                if(arg.includes(':')) {
                    const ids = getRange(arg);
                    for(const id of ids){
                        const val = getNum(getValue(id));
                        if(val !== null) vals.push(val);
                    }
                } else {
                    const val = getNum(
                        arg.match(/^[A-Z]+[0-9]+$/) ? getValue(arg) : arg
                    );
                    if(val !== null) vals.push(val);
                }
            }

            const funcRes = evaluateFunction(func, vals);
            output.push(funcRes.toString());
            i = nextIdx;

        // handle cell references
        } else if(t.match(/^[A-Z]+[0-9]+$/)) {
            if (rawVal === null || rawVal === undefined || rawVal === '') {
                output.push('0'); // empty cell treated as 0
            } else if (typeof rawVal === 'number') {
                output.push(rawVal.toString());
            } else if (typeof rawVal === 'string') {
                if (rawVal.startsWith('=')) {
                    output.push(rawVal);
                } else {
                    // pure cell reference, no arithmetic needed
                    if (tokens.length === 1) {
                        output.push(JSON.stringify(rawVal));
                    } else if (!isNaN(Number(rawVal))) {
                        output.push(rawVal);
                    } else {
                        throw new Error('#VALUE!');
                    }
                }
            } else {
                output.push(String(rawVal));
            }
            i++;
        // at this point, just numbers, operators pass through
        } else {
            output.push(t);
            i++;
        }
    }

    return output.join(' ');
}


function parseArgs(tokens: string[], startIdx: number) {
    const args: string[] = [];
    let curr = '';
    let layer = 0;

    for(let i = startIdx; i < tokens.length; i++){
        const t = tokens[i];

        if (t === '('){
            layer++;
            curr += t;
        } else if(t === ')'){
            if (layer === 0){
                if (curr){
                    args.push(curr);
                    const nextIdx = i+1;
                    return { args, nextIdx};
                }
            } else {
                layer--;
                curr += t;
            }
        } else if(t === ',' && layer === 0){
            args.push(curr);
            curr = '';
        } else {
            curr += t;
        }
    }
    throw new Error('#VALUE!');
}

function getRange(range: string): string[] {
    const match = range.match(/([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$/);

    if(!match){
        return [];
    }
    const [, startC, startR, endC, endR] = match;

    const startCol = colToIdx(startC);
    const endCol = colToIdx(endC);
    const startRow = parseInt(startR, 10);
    const endRow = parseInt(endR, 10);

    const cells: string[] = [];
    for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++){
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++){
            const cellId = `${idxToCol(c)}${r}`;
            cells.push(cellId);
        }
    }
    return cells;
}

function idxToCol(idx: number): string {
    let col = '';
    while (idx >= 0){
        const rem = (idx-1) % 26
        col = String.fromCharCode(65 + rem) + col;
        idx = Math.floor((idx - 1) / 26);
    }
    return col;
}

function colToIdx(col: string): number {
    let idx = 0;
    for (let i = 0; i < col.length; i++){
        idx = idx*26 + (col.charCodeAt(i) - 64);
    }
    return idx;
}

function evaluateFunction(func: string, args: number[]): number {
    switch(func){
        case 'SUM': {
            let curr = 0;
            for (const num of args){
                curr += num;
            }
            return curr;
        }

        case 'AVG': {
            if (args.length === 0) {
                throw new Error('#DIV/0!');
            }
            let avg = 0;
            for (const num of args){
                avg += num;
            }
            return avg/args.length;
        }

        default:
            throw new Error('#NAME?')
            
    }

}

function getNum(val: string | number | null): number | null {
    if (val === null || val === ''){
        return 0;
    }
    const num = parseFloat(val.toString()); // safe float assurance
    return isNaN(num) ? null: num;
}

function evaluateExpression(expr: string): number {
    // Shunting Yard Algorithm
    const outQueue: string[] = [];
    const opStack: string[] = [];
    const precedence: Record<string, number> = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2
    }
    const tokens = expr.match(/[+\-*/()]|[0-9]+(\.[0-9]+)?/g);
    if(!tokens){
        throw new Error('#VALUE!');
    }

    for (const token of tokens){
        if (!isNaN(parseFloat(token))){
            outQueue.push(token);
        } else if (token in precedence){ 
            while (
                opStack.length > 0 &&
                opStack[opStack.length-1] in precedence &&
                precedence[token] <= precedence[opStack[opStack.length-1]]
            ){
                outQueue.push(opStack.pop()!);
            }
            opStack.push(token);
        } else if (token === '('){
            opStack.push(token);
        } else if (token === ')'){
            while(opStack.length > 0 && opStack[opStack.length-1] !== '(') {
                outQueue.push(opStack.pop()!);
                }
            if (opStack.length === 0) {
                throw new Error("#SYNTAX!");
            }
            opStack.pop(); // pop the '('
        
        } else {
                throw new Error('#SYNTAX!');
        }
    }
    while(opStack.length > 0){
        const op = opStack.pop()!;
        if (op === '(' || op === ')'){
            throw new Error('#SYNTAX!');
        }
        outQueue.push(op);
    }

    const stack: number[] = [];
    for (const token of outQueue){
        if(!isNaN(parseFloat(token))){
            stack.push(parseFloat(token));
        } else {
            const b = stack.pop();
            const a = stack.pop(); //note the order since it's a stack
            if (a === undefined || b === undefined){
                throw new Error('#VALUE!')
            }
            switch(token){
                case '+': 
                    stack.push(a+b);
                    break;
                case '-': 
                    stack.push(a-b);
                    break;
                case '*': 
                    stack.push(a*b);
                    break;
                case '/':
                    if (b === 0){
                        throw new Error('#DIV/0!')
                        break;
                    } 
                    stack.push(a/b);
                    break;
                default:
                    throw new Error('#VALUE!')
            }
        }
    }
    if (stack.length !== 1){
        throw new Error('#VALUE!')
    }
    return stack.pop()!;
}

export function extractReferences(input: string): string[] {
    if (!input.startsWith('=')){
        return [];
    }
    const refs = input.slice(1).match(/[A-Z]+[0-9]+/g)
    return refs ? Array.from(new Set(refs)) : [];
}

export default function evaluateFormula(
    input: string,
    getValue: (cellId: string) => string | number | null
): EvalResult {
    if (!input.startsWith('=')){
        return { value: input };
    }

    try{
        const formula = input.slice(1).trim();
        const tokens = tokenize(formula);
        if (tokens.length === 1 && tokens[0].match(/^([A-Z]+)([0-9]+)$/)) {
            return { value: getValue(tokens[0]) as string }
        }
        const replaced = replaceTokens(tokens, getValue);
        const val = evaluateExpression(replaced);
        return { value: val };
    } catch(e){
        return { error: e instanceof Error ? '#REF!': String(e) };
    }
}