export interface LayerConfig {
  file: string;
  tag: string;
  left: number;
  top: number;
  width: number;
  height: number;
  cssClass?: string;
  id?: string;
  /** Shoulder pivot for arm layers, in % of crop size. Auto-detected from body overlap. */
  pivot?: { x: number; y: number };
  /** Which hand holds this object (e.g. "handwear-r"). Auto-detected from overlap. */
  heldBy?: string;
}

export interface CharacterConfig {
  id: string;
  name: string;
  status: string;
  statusEmoji: string;
  mode: 'layered';
  layers: LayerConfig[];
  stageSize: number;
  x: number;
  y: number;
  scale: number;
  greeting: string;
}
