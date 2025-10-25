import { useMemo, useRef } from "react";
import { Cell } from "./Cell";
import { Grid, type GridCellRenderer } from 'react-virtualized';

export const VirtualGrid = () => {
  const ROW_HEIGHT = 32;
  const COL_WIDTH = 96;
  const ROW_COUNT = 100;
  const COL_COUNT = 100;
  const HEADER_HEIGHT = ROW_HEIGHT;
  const ROW_HEADER_WIDTH = 50;
  // const VISIBLE_WIDTH = 800; 
  // const VISIBLE_HEIGHT = 400;

  const colHeaders = useMemo(
    () => 
      Array.from({ length: COL_COUNT }, (_,i) => {
        let col = '';
        let n = i+1;
        while(n>0){
          const rem = (n-1) % 26;
          col = String.fromCharCode(65 + rem) + col
          n = Math.floor((n-1) / 26);
        }
        return col;
      }),
      [COL_COUNT]
    );

  const rowHeaderContentRef = useRef<HTMLDivElement | null>(null);

  // const gridScrollHandler = ({ scrollTop }: { scrollTop : number }) => {
  //   if (rowHeaderContentRef.current) {
  //     rowHeaderContentRef.current.scrollTop = scrollTop
  //   }
  // };


  const cellRenderer: GridCellRenderer = ({ columnIndex, rowIndex, style }) => {
    return (
      <div style={style} key={`${rowIndex}-${columnIndex}`}>
        <Cell row={rowIndex} col={columnIndex}/>
      </div>
    );
  }

  return (
    <div 
      style={{ 
        position: 'relative', 
        width: '100vw', 
        height: '80vh', 
        overflow: "auto",
      }}
    >
      {/* Column headers */}
      <div
        style={{
          display: "flex",
          position: "sticky",
          width: COL_WIDTH * COL_COUNT,
          top: 0,
          zIndex: 10,
          backgroundColor: "#f97316",
          marginLeft: ROW_HEADER_WIDTH,
        }}
      >
        {/* Top-left corner */}
        <div style={{ width: 0, height: HEADER_HEIGHT }} /> 
        {colHeaders.map((label, idx) => (
          <div
            key={idx}
            style={{
              width: COL_WIDTH,
              height: HEADER_HEIGHT,
              borderBottom: "1px solid #d1d5db",
              borderRight: "1px solid #d1d5db",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontWeight: 600,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        ref={rowHeaderContentRef}
        style={{ willChange: 'transform' }}
      >
        {/* Row headers */}
        <div
          style={{
            display: 'flex',
            position: 'sticky',
            width: ROW_HEADER_WIDTH,
            top: HEADER_HEIGHT,
            zIndex: 10,
            backgroundColor: '#f97316',
            left: 0,
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <div
              key={i}
              style={{
                width: ROW_HEADER_WIDTH,
                height: ROW_HEIGHT,
                borderBottom: "1px solid #d1d5db",
                borderRight: "1px solid #d1d5db",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f97316",
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

        {/* Virtualized Grid */}
        <Grid
          columnCount={COL_COUNT}
          rowCount={ROW_COUNT}
          columnWidth={COL_WIDTH}
          rowHeight={ROW_HEIGHT}
          height={400}
          width={COL_COUNT * COL_WIDTH + ROW_HEADER_WIDTH}
          cellRenderer={cellRenderer}
          onScroll={({ scrollTop }) => {
            if (rowHeaderContentRef.current) {
              rowHeaderContentRef.current.style.transform = `translateY(-${scrollTop}px)`
            }
          }}
          style={{ position: 'absolute', top: HEADER_HEIGHT, left: 50 }}
        >
        </Grid>
    </div>
  );
};