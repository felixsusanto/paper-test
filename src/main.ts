import paper from "paper";
import seedrandom from "seedrandom";
import { bottomVerticalLineRenderer, leftHorizontalLineRenderer, rightHorizontalLineRenderer, topVerticalLineRenderer } from "./utils";
import _ from 'lodash';
import "reset-css";
import "./style.css";

(() => {
  const global = paper;
  (window as any).global = global;
  const STROKE_WIDTH = 6;
  
  global.setup("canvas");
  const viewSize = global.project.view.viewSize;
  const palette = {
    blue: "#4754bd",
    red: "#e44525",
    yellow: "#f1d93b",
    black: "#000",
  }; 
  const rng = seedrandom('Abcde' , { global: true }); 
  const {black, ...colorPalette} = palette;
  const paletteArr = Object.values(palette);
  
  type RoundingFn = (x: number) => number;
  
  const grid = (percent: number, scope: paper.PaperScope, debug = true): RoundingFn => {
    const { width, height } = scope.view.viewSize;
    const gridSize = Math.floor(percent * width);
    if (debug) {
      const columns = Array(Math.floor(width / gridSize))
        .fill('')
        .map((_, i) => {
          return ((i + 1) * gridSize); 
        })
      ;
      const rows = Array(Math.floor(height / gridSize))
        .fill('')
        .map((_, i) => {
          return ((i + 1) * gridSize);
        })
      ;
      const rectPoints: paper.Point[] = [];
      rows.forEach((row, ri) => {
        columns.forEach((col, ci) => {
          const point = new paper.Point(col, row);
          const firstIndex = ri === 0 && ci === 0;
          const lastIndex = ri === (rows.length - 1) && ci === (columns.length - 1);
          if (firstIndex || lastIndex) {
            rectPoints.push(point);
          }
          const circle = new paper.Path.Circle(point, 3);
          circle.fillColor = (new paper.Color('#b4da55'));
        });
      });
      const rectDebug = new paper.Path.Rectangle(rectPoints[0]!, rectPoints[1]!);
      rectDebug.selected = true;
    }
    return (x: number) => {
      const remainder = x % gridSize;
      const rounding = Math.round(x - remainder);
      if (rounding === 0) return gridSize;
      return rounding;
    };
  };
  
  const roundingFn = grid(0.03, global, false);
  
  const rectangleSeed = (roundingFn:(x: number) => number = (x) => x) => {
    const range: [number, number] = [0.05, 0.4];
    const minMaxWidth: [min: number, max: number] = range;
    const minMaxHeight: [min: number, max: number] = range;
    const { width, height } = viewSize;
  
    const rectWRaw = (minMaxWidth[0] * width) + (Math.abs(minMaxWidth[1] - minMaxWidth[0]) * width * Math.random());
    const rectHRaw = (minMaxHeight[0] * height) + (Math.abs(minMaxHeight[1] - minMaxHeight[0]) * height * Math.random());
    const rectW = roundingFn(rectWRaw);
    const rectH = roundingFn(rectHRaw);
    const size = new global.Size(rectW, rectH);
    const boundaryW = width - rectW;
    const boundaryH = height - rectH;
  
    const posRaw: [number, number] = [Math.random() * boundaryW, Math.random() * boundaryH];
    const pos: [number, number] = posRaw.map(roundingFn) as [number, number];
    const point = new global.Point(...pos);
    const rect = new global.Path.Rectangle(point, size);
    rect.fillColor = new global.Color(palette.blue)
    return rect;
  };
  
  type ProximityCheck = (r1: paper.Path.Rectangle, r2: paper.Path.Rectangle, p: number) => boolean;
  
  const isTooNear: ProximityCheck = (rect1, rect2, padding) => {
    const rect2IsInsideRect1 = rect2.isInside(rect1.bounds);
    const rect1IsInsideRect2 = rect1.isInside(rect2.bounds);
    const rect1IsIntersectingRect2 = rect1.bounds.expand(padding).intersects(rect2.bounds);
    const rect2IsIntersectingRect1 = rect2.bounds.expand(padding).intersects(rect1.bounds);
    return rect2IsInsideRect1 || rect1IsInsideRect2 || rect1IsIntersectingRect2 || rect2IsIntersectingRect1;
  };
  
  const rectangleFromLineIntersections = (lines: paper.Path.Line[], debug = false) => {
    const gridPointsRaw = {x: new Set<number>(), y: new Set<number>()};
    const points: paper.Point[] = [];
    lines.map(l => {
        l.strokeWidth = STROKE_WIDTH;
        l.strokeColor = new paper.Color('#000');
        // l.selected = true;
        return l;
      })
      .forEach((l, i, arr) => {
        arr.forEach(innerL => {
          if (l === innerL) return;
          const ints = l.getIntersections(innerL);
          ints.forEach((cl) => {
            if (debug) {
              const c = new paper.Path.Circle(cl.point, 3);
              c.fillColor = new paper.Color('#b4da55');
            }
            cl.point.x = Math.round(cl.point.x);
            cl.point.y = Math.round(cl.point.y);
            points.push(cl.point);
            const { x, y } = cl.point;
            gridPointsRaw.x.add(x);
            gridPointsRaw.y.add(y);
          });
        })
      })
    ;
    const gridPoints = { x: [...gridPointsRaw.x.values()].sort((a,b) => a - b), y: [...gridPointsRaw.y.values()].sort((a,b) => a - b)};
    
    points.forEach(point => {
      const {x, y} = point;
      const xIndex = gridPoints.x.findIndex(v => v === x);
      const yIndex = gridPoints.y.findIndex(v => v === y);
      if (debug) {
        var text = new paper.PointText(point.add(15));
        text.content = `[${xIndex},${yIndex}]`;
        text.fillColor = new paper.Color('#00f');
      }
    })
    console.log(gridPoints);
    const diags: [[x: number, y: number], [x2: number, y2: number]][] = [];
    gridPoints.x.forEach((x, xi, arrX) => {
      const isXLastIndex = (arrX.length - 1) === xi;
      if (isXLastIndex) return;
      gridPoints.y.forEach((y, yi, arrY) => {
        const isYLastIndex = (arrY.length - 1) === yi;
        if (isYLastIndex) return;
        diags.push([[x, y], [arrX[xi+1], arrY[yi+1]]]);
      });
    });
    diags.forEach((diag) => {
      const [point1, point2] = diag;
      const r = new paper.Path.Rectangle(new paper.Point(...point1), new paper.Point(...point2));
      const colorIndex = Math.floor(Math.random() * paletteArr.length);
      r.fillColor = new paper.Color(paletteArr[colorIndex]);
      if (debug) {
        const dg = new paper.Path.Line(new paper.Point(...point1), new paper.Point(...point2));
        dg.strokeColor = r.fillColor;
        r.opacity = 0.2;
      }
      // r.selected = true;
      r.sendToBack();
    });
  };

  const render = (totalSeed: number, proximityCheck: ProximityCheck, rounding: RoundingFn) => {
    // const rectExpanded: paper.Rectangle[] = [];
    const rectCollection: paper.Path.Rectangle[] = [];
    const EXPAND_RANGE = STROKE_WIDTH * 10;
    (window as any).collection = rectCollection;
    for (let i = 0; i < totalSeed; i++) {
      let uncommitedRect = rectangleSeed(rounding);
      if (!rectCollection.length) {
        rectCollection.push(uncommitedRect);
      } else {
        while(rectCollection.some(r => proximityCheck(r, uncommitedRect, EXPAND_RANGE))) {
          uncommitedRect.remove();
          uncommitedRect = rectangleSeed(rounding);
        }
        uncommitedRect.fillColor = new global.Color(paletteArr[i % paletteArr.length]!);
        rectCollection.push(uncommitedRect);
      }
    }
    const lines: paper.Path.Line[] = [];
    rectCollection.forEach((rect, index, rectArr) => {
      [
        leftHorizontalLineRenderer(rect, rectArr, 'topLeft', global),
        rightHorizontalLineRenderer(rect, rectArr, 'topLeft', global),
        topVerticalLineRenderer(rect, rectArr, 'topLeft', global),
        bottomVerticalLineRenderer(rect, rectArr, 'topLeft', global),
        leftHorizontalLineRenderer(rect, rectArr, 'bottomRight', global),
        rightHorizontalLineRenderer(rect, rectArr, 'bottomRight', global),
        topVerticalLineRenderer(rect, rectArr, 'bottomRight', global),
        bottomVerticalLineRenderer(rect, rectArr, 'bottomRight', global),
      ].forEach(l => lines.push(l))
    });
    console.log(lines);
    rectangleFromLineIntersections(lines, true);
  };
  
  render(4, isTooNear, roundingFn);
  
  const scratchpad = () => {
    const { width, height } = global.view.viewSize;
    const vLine = (x: number): [paper.Point, paper.Point] => {
      return [
        new paper.Point(x, 0),
        new paper.Point(x, height)
      ];
    };
    const hLine = (y: number): [paper.Point, paper.Point] => {
      return [
        new paper.Point(0, y),
        new paper.Point(width, y)
      ];
    };
  
    
    const lines = [
        new paper.Path.Line(...vLine(roundingFn(Math.random() * width))),
        new paper.Path.Line(...hLine(roundingFn(Math.random() * height))),
        new paper.Path.Line(...vLine(roundingFn(Math.random() * width))),
        new paper.Path.Line(...hLine(roundingFn(Math.random() * height))),
        new paper.Path.Line(...vLine(roundingFn(Math.random() * width))),
        new paper.Path.Line(...hLine(roundingFn(Math.random() * height))),
        new paper.Path.Line(...vLine(roundingFn(Math.random() * width))),
        new paper.Path.Line(...hLine(roundingFn(Math.random() * height))),
      ];
    
    rectangleFromLineIntersections(lines);
    
  };
  
  // scratchpad();
})();