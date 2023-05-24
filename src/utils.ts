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
(rect: paper.Path.Rectangle, rectArr: paper.Path.Rectangle[], origin: Origin, scope: paper.PaperScope) => {
  const { x, y } = rect.bounds[origin];
  const line = new paper.Path.Line({
    from: [x, y],
    to: props.toFn(x,y, scope),
    strokeColor: 'black',
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
  toFn: (x, y) => [0, y],
  sortFn: (locA, locB) => locB.point.x - locA.point.x,
  debug: false,
  orientation: 'horizontal',
}

export const leftHorizontalLineRenderer = factoryLineRenderer(leftHorizontalRendererProps);

const rightHorizontalLineRendererProps: FactoryProps = {
  toFn: (x, y, scope) => [scope.project.view.viewSize.width, y],
  sortFn: (locA, locB) => locA.point.x - locB.point.x,
  debug: false,
  orientation: 'horizontal',
}

export const rightHorizontalLineRenderer = factoryLineRenderer(rightHorizontalLineRendererProps);

const topVerticalLineRendererProps: FactoryProps = {
  toFn: (x, y) => [x, 0],
  sortFn: (locA, locB) => locB.point.y - locA.point.y,
  debug: false,
  orientation: 'vertical',
}

export const topVerticalLineRenderer = factoryLineRenderer(topVerticalLineRendererProps);

const bottomVerticalLineRendererProps: FactoryProps = {
  toFn: (x, y, scope) => [x, scope.project.view.viewSize.height],
  sortFn: (locA, locB) => locA.point.y - locB.point.y,
  debug: false,
  orientation: 'vertical',
}

export const bottomVerticalLineRenderer = factoryLineRenderer(bottomVerticalLineRendererProps);
