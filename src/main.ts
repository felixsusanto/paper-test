import paper from "paper";
import seedrandom from "seedrandom";
import { bottomVerticalLineRenderer, leftHorizontalLineRenderer, rightHorizontalLineRenderer, topVerticalLineRenderer } from "./utils";
import _ from 'lodash';
import "reset-css";
import "./style.scss";

let title: string | null = null;
const getQueryParams = /(\?.+)/.exec(window.location.href);
if (getQueryParams) {
  const queryParams = getQueryParams[1];
  const search = new URLSearchParams(queryParams);
  title = search.get('title');
}

const interaction = () => {
  if (title) {
    const titleNode = document.getElementById('art-title')!;
    titleNode.innerText = title;
  }
  const canvasCta = document.getElementById('download-cta')!;
  canvasCta.onclick = () => {
    const api = (window as any).global as paper.PaperScope;
    const svg = api.project.exportSVG() as SVGAElement;
    const node = svg;

    const [w, h] = [+node.getAttribute('width')!, +node.getAttribute('height')!]
      .map(n => n * 2)
    ;
    node.setAttribute('width', `${w}`);
    node.setAttribute('height', `${h}`);

    const s = new XMLSerializer();
    const svgString = s.serializeToString(svg);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(svgString as string));
    element.setAttribute('download', 'artwork.svg');

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  };
};

const canvasRender = (seed: string | null) => {
  const global = paper;
  (window as any).global = global;
  const STROKE_WIDTH = 6;
  
  global.setup("canvas");
  const viewSize = global.project.view.viewSize;
  const palette: Record<string, string> = {
    blue: "#4754bd",
    red: "#e44525",
    yellow: "#f1d93b",
    black: "#000",
  }; 
  let stringSeed = '';
  if (seed) {
    stringSeed = seed;
  } else {
    stringSeed = (new Date().valueOf()) + '';
    const titleNode = document.getElementById('art-title')!;
    titleNode.innerText = stringSeed;
  }
  const rng = seedrandom(seed ? seed : `${new Date().valueOf()}` , { global: true }); 
  
  type RoundingFn = (x: number) => number;

  const oddsWeightFactory = (oddsConfig: Record<string, number>) => {
    const keys: string[] = [];
    const brackets: number[] = [];
    let total = 0;
    Object.entries(oddsConfig).forEach(([key, value]) => {
      keys.push(key);
      total += value;
      brackets.push(total);
    });
    return (x: number) => {
      const num = x * total;
      let resIndex = -1;
      for (let index = 0; index < brackets.length; index++) {
        if (num < brackets[index]) {
          resIndex = index;
          break;
        }
      }
      return keys[resIndex];
    }
  };

  const colorWeights = oddsWeightFactory({
    transparent: 60,
    blue: 16,
    red: 13,
    yellow: 13,
    black: 4,
  });

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
  
  const rectangleSeedFactory = (range: [number, number])  => (roundingFn:(x: number) => number = (x) => x) => {
    // const range: [number, number] = [0.05, 0.4];
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
  const rectangleSeed = rectangleSeedFactory([0.2, 0.4]);
  
  type ProximityCheck = (r1: paper.Path.Rectangle, r2: paper.Path.Rectangle, p: number) => boolean;
  
  const isTooNear: ProximityCheck = (rect1, rect2, padding) => {
    const rect2IsInsideRect1 = rect2.isInside(rect1.bounds);
    const rect1IsInsideRect2 = rect1.isInside(rect2.bounds);
    const rect1IsIntersectingRect2 = rect1.bounds.expand(padding).intersects(rect2.bounds);
    const rect2IsIntersectingRect1 = rect2.bounds.expand(padding).intersects(rect1.bounds);
    return rect2IsInsideRect1 || rect1IsInsideRect2 || rect1IsIntersectingRect2 || rect2IsIntersectingRect1;
  };
  
  const rectangleFromLineIntersections = (lines: paper.Path.Line[], scope: paper.PaperScope, debug = false) => {
    const { height, width } = scope.view.viewSize;
    const gridPointsRaw = {
      x: new Set<number>(), 
      y: new Set<number>(),
      coordinates: new Map<string, [number, number]>(),
    };
    
    [[0,0],[width, 0],[0, height],[width, height]]
      .forEach((coor) => {
        const [x, y] = coor;
        gridPointsRaw.coordinates.set(`${x}, ${y}`, [x,y]);
      })
    ;
    lines
      .forEach((l, i, arr) => {
        arr.forEach(innerL => {
          if (l === innerL) return;
          const ints = l.getIntersections(innerL);
          ints.forEach((cl) => {
            cl.point.x = Math.round(cl.point.x);
            cl.point.y = Math.round(cl.point.y);
            const { x, y } = cl.point;
            gridPointsRaw.x.add(x);
            gridPointsRaw.y.add(y);
            const key = `${x},${y}`;
            if(!gridPointsRaw.coordinates.has(key)) {
              gridPointsRaw.coordinates.set(key, [x, y]);
              if (debug) {
                const c = new paper.Path.Circle(cl.point, 3);
                c.fillColor = new paper.Color('#b4da55');
              }
            }
          });
        })
      })
    ;
    const gridPoints = { 
      x: [...gridPointsRaw.x.values()].sort((a,b) => a - b), 
      y: [...gridPointsRaw.y.values()].sort((a,b) => a - b),
      coordinates: _.orderBy([...gridPointsRaw.coordinates.values()], ['1', '0'])
    };
    interface Coordinate {
      index: [number, number];
      position: [number, number];
    };
    const coordinates = gridPoints.coordinates.map(point => {
      const [x, y] = point;
      const xIndex = gridPoints.x.findIndex(v => v === x);
      const yIndex = gridPoints.y.findIndex(v => v === y);
      if (debug) {
        var text = new paper.PointText(new paper.Point(x+5, y+15));
        text.content = `[${xIndex},${yIndex}]`;
        text.fillColor = new paper.Color('#00f');
      }
      const coordinate: Coordinate = {
        index: [xIndex, yIndex],
        position: [x, y],
      };
      return coordinate;
    });
    const indexes = {
      horizontal: _.groupBy(coordinates, (o) => o.index[1]),
      vertical: _.groupBy(coordinates, (o) => o.index[0]),
    };
    coordinates.forEach((coor, index, arr) => {
      const {index: [idx, idy]} = coor;
      const curr: [number, number] = [idx, idy];
      if (gridPoints.x.length === (idx + 1) || gridPoints.y.length === (idy + 1)) return;
      const nextColNodeGroup = indexes.horizontal[idy];
      const nextColNodeIndex = _.findIndex(nextColNodeGroup, (o) => _.isEqual(o.index, curr)) + 1;
      const nextColNode: [number, number] | undefined  = nextColNodeGroup[nextColNodeIndex]?.index;
      const nextRowNodeGroup = indexes.vertical[idx];
      const nextRowNodeIndex = _.findIndex(nextRowNodeGroup, (o) => _.isEqual(o.index, curr)) + 1;
      const nextRowNode: [number, number] | undefined = nextRowNodeGroup[nextRowNodeIndex]?.index;
      if (!nextColNode || !nextRowNode) return;
      const nodeCheck = _.zip(nextColNode, nextRowNode).map((arr) => Math.max(...arr as [number, number])) as [number, number];
      const nodeCheckIndex = _.findIndex(coordinates, (o) => _.isEqual(o.index, nodeCheck));
      if (nodeCheckIndex !== -1) {
        // draw Rectangle!
        const currCoor = coor.position;
        const nodeCoor = coordinates[nodeCheckIndex].position;
        const r = new paper.Path.Rectangle(new paper.Point(...currCoor), new paper.Point(...nodeCoor));
        const colorName = colorWeights(Math.random());
        // const colorIndex = Math.floor(Math.random() * paletteArr.length);
        r.fillColor = colorName === 'transparent' ? null : new paper.Color(palette[colorName]);
        if (debug) {
          const dg = new paper.Path.Line(new paper.Point(...currCoor), new paper.Point(...nodeCoor));
          dg.strokeColor = r.fillColor;
          dg.selected = true;
          r.opacity = 0.2;
        }
        // r.selected = true;
        r.sendToBack();
      }
    })
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
        const colorName = colorWeights(Math.random());
        uncommitedRect.fillColor = colorName === 'transparent' ? null : new global.Color(palette[colorName]);
        rectCollection.push(uncommitedRect);
      }
    }
    const canvasRect = new paper.Path.Rectangle(
      new paper.Point(0,0),
      new paper.Point(global.view.viewSize.width, global.view.viewSize.height)
    );
    canvasRect.strokeColor = null;
    const lines: (paper.Path.Line | paper.Path.Rectangle)[] = [
      canvasRect
    ];
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
    rectangleFromLineIntersections(lines, global);
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
    
    rectangleFromLineIntersections(lines, global);
    
  };
  
  // scratchpad();
};
canvasRender(title);
interaction();