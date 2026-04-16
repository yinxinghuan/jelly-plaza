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
