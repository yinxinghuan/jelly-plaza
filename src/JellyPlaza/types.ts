export interface LayerConfig {
  file: string;
  tag: string;
  left: number;
  top: number;
  width: number;
  height: number;
  cssClass?: string;
  id?: string;
}

export interface CharacterConfigBase {
  id: string;
  name: string;
  status: string;
  statusEmoji: string;
  /** Position in plaza (percentage) */
  x: number;
  y: number;
  /** Scale factor */
  scale: number;
  /** Greeting bubble text */
  greeting: string;
}

export interface LayeredCharacter extends CharacterConfigBase {
  mode: 'layered';
  layers: LayerConfig[];
  /** Stage size (original canvas) */
  stageSize: number;
}

export interface SingleImageCharacter extends CharacterConfigBase {
  mode: 'single';
  /** Path to full character image */
  image: string;
  /** Image natural width/height for aspect ratio */
  imageWidth: number;
  imageHeight: number;
}

export type CharacterConfig = LayeredCharacter | SingleImageCharacter;
