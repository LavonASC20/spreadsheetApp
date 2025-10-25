import { FormulaBar } from './components/FormulaBar';
import { VirtualGrid } from './components/VirtualGrid';
import { SpreadsheetProvider } from './context/SpreadsheetContext';

export default function App() {
    return (
        <SpreadsheetProvider>
            <div className='flex flex-col h-screen w-full bg-gray-40'>
                <header className="border-b p-2 font-semibold text-lg">Zinsheet</header>
                <FormulaBar />
                <div className="flex flex-1 overflow-hidden">
                    <VirtualGrid />
                </div>
            </div>
        </SpreadsheetProvider>
    )
}