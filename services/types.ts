export type NumPair = [number, number];
export type NumPairs = NumPair[];

export type CrossingSpec = [
  crossing_id: number,
  under_line: number | null,
  over_line: number | null,
  crossing_x: number,
  crossing_y: number,
];
export type CrossingSpecs = CrossingSpec[];

export type Placement = 'over' | 'under';
export type Position = Placement;

export interface FullNotationLine {
  strand_id: number;
  placement: Placement;
  arcs: [number, number];
  crossing_id: number;
  edges?: [number, number];
  position?: Placement;
}

export type FullNotationEntry = FullNotationLine;
export type FullNotation = FullNotationLine[];

export type Geometry = {
  vertex_positions: NumPairs
  arrows: NumPairs
  crossing_specs: CrossingSpecs
};

export type VertexAndArrow = {
  point: number;
  strand_x: number;
  strand_y: number;
  handedness: string | null;
};
export type VerticesAndArrows = VertexAndArrow[];

export type RolfKnotName = {
  numCrossings: string
  rolfIndexes: string[]
};
export type RolfKnotNames = RolfKnotName[];

export type Invariants = {
  determinant: number;
  alexander_polynomial: string;
  jones_polynomial: string;
}

export type GeometricLine = {
  cid1: number;
  placement1: Placement;
  cid2: number;
  placement2: Placement;
}
