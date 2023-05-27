import paper from 'paper';

const STROKE_WIDTH = 6;

interface FactoryProps {
  toFn: (x: number, y: number, scope: paper.PaperScope) => [number, number];
  sortFn: (a: paper.CurveLocation, b: paper.CurveLocation) => number;
  orientation: 'vertical' | 'horizontal';
  debug: boolean;
}

type Origin = 'bottomLeft' | 'topLeft' | 'topRight' | 'bottomRight';

const factoryLineRenderer = (props: FactoryProps) => 
(rect: paper.Path.Rectangle, rectArr: paper.Path.Rectangle[], origin: Origin, scope: paper.PaperScope, color?: string) => {
  const { x, y } = rect.bounds[origin];
  const line = new paper.Path.Line({
    from: [x, y],
    to: props.toFn(x,y, scope),
    strokeColor: color || 'black',
  });
  line.strokeWidth = STROKE_WIDTH;
  line.selected = props.debug;
  const totalIntersections: paper.CurveLocation[][] = [];
  rectArr.forEach((sRect) => {
    if (rect !== sRect) {
      const intersections = line.getIntersections(sRect);
      if (intersections.length) {
        totalIntersections.push(intersections);
      }
    }
  });
  totalIntersections.flat()
    .sort(props.sortFn)
    .forEach((curveLoc, index) => {
      line.insert(index + 1, curveLoc.point);
    })
  ;
  line.segments[1]!.selected = props.debug;
  // console.log(line.segments);
  if (line.segments.length > 2) {
    const o: Record<FactoryProps['orientation'], 'x' | 'y'> = {
      vertical: 'y',
      horizontal: 'x',
    }
    const o1 = line.segments[0]!.point[o[props.orientation]];
    const o2 = line.segments[1]!.point[o[props.orientation]];
    const dist = Math.abs(o1 - o2);
    const newLine = line.splitAt(dist);
    newLine.remove();
  }
  return line;
};

const leftHorizontalRendererProps: FactoryProps = {
  toFn: (_, y) => [0, y],
  sortFn: (locA, locB) => locB.point.x - locA.point.x,
  debug: false,
  orientation: 'horizontal',
}

export const leftHorizontalLineRenderer = factoryLineRenderer(leftHorizontalRendererProps);

const rightHorizontalLineRendererProps: FactoryProps = {
  toFn: (_, y, scope) => [scope.project.view.viewSize.width, y],
  sortFn: (locA, locB) => locA.point.x - locB.point.x,
  debug: false,
  orientation: 'horizontal',
}

export const rightHorizontalLineRenderer = factoryLineRenderer(rightHorizontalLineRendererProps);

const topVerticalLineRendererProps: FactoryProps = {
  toFn: (x) => [x, 0],
  sortFn: (locA, locB) => locB.point.y - locA.point.y,
  debug: false,
  orientation: 'vertical',
}

export const topVerticalLineRenderer = factoryLineRenderer(topVerticalLineRendererProps);

const bottomVerticalLineRendererProps: FactoryProps = {
  toFn: (x, _, scope) => [x, scope.project.view.viewSize.height],
  sortFn: (locA, locB) => locA.point.y - locB.point.y,
  debug: false,
  orientation: 'vertical',
}

export const bottomVerticalLineRenderer = factoryLineRenderer(bottomVerticalLineRendererProps);

export type RoundingFn = (x: number) => number;

export const grid = (percent: number, scope: paper.PaperScope, debug = true): RoundingFn => {
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

export const rectangleSeedFactory = (range: [number, number], scope: paper.PaperScope)  => (roundingFn:(x: number) => number = (x) => x) => {
  const minMaxWidth: [min: number, max: number] = range;
  const minMaxHeight: [min: number, max: number] = range;
  const { width, height } = scope.view.viewSize;

  const rectWRaw = (minMaxWidth[0] * width) + (Math.abs(minMaxWidth[1] - minMaxWidth[0]) * width * Math.random());
  const rectHRaw = (minMaxHeight[0] * height) + (Math.abs(minMaxHeight[1] - minMaxHeight[0]) * height * Math.random());
  const rectW = roundingFn(rectWRaw);
  const rectH = roundingFn(rectHRaw);
  const size = new scope.Size(rectW, rectH);
  const boundaryW = width - rectW;
  const boundaryH = height - rectH;

  const posRaw: [number, number] = [Math.random() * boundaryW, Math.random() * boundaryH];
  const pos: [number, number] = posRaw.map(roundingFn) as [number, number];
  const point = new scope.Point(...pos);
  const rect = new scope.Path.Rectangle(point, size);
  // rect.fillColor = new scope.Color(palette.blue)
  return rect;
};

export type ProximityCheck = (r1: paper.Path.Rectangle, r2: paper.Path.Rectangle, p: number) => boolean;
  
export const isTooNear: ProximityCheck = (rect1, rect2, padding) => {
  const rect2IsInsideRect1 = rect2.isInside(rect1.bounds);
  const rect1IsInsideRect2 = rect1.isInside(rect2.bounds);
  const rect1IsIntersectingRect2 = rect1.bounds.expand(padding).intersects(rect2.bounds);
  const rect2IsIntersectingRect1 = rect2.bounds.expand(padding).intersects(rect1.bounds);
  return rect2IsInsideRect1 || rect1IsInsideRect2 || rect1IsIntersectingRect2 || rect2IsIntersectingRect1;
};

export const renderNonOverlappingRectangles = (
  rectangleSeed: (roundingFn?: RoundingFn) => paper.Path.Rectangle, 
  roundingFn: RoundingFn,
  expandRange: number,
  totalRectangle: number,
  proximityCheck: ProximityCheck = isTooNear,
) => {
const rectCollection: paper.Path.Rectangle[] = [];
const EXPAND_RANGE = expandRange;

for (let i = 0; i < totalRectangle; i++) {
  let uncommitedRect = rectangleSeed(roundingFn);
  if (!rectCollection.length) {
    rectCollection.push(uncommitedRect);
  } else {
    while(rectCollection.some(r => proximityCheck(r, uncommitedRect, EXPAND_RANGE))) {
      uncommitedRect.remove();
      uncommitedRect = rectangleSeed(roundingFn);
    }
    rectCollection.push(uncommitedRect);
  }
}
return rectCollection;
}