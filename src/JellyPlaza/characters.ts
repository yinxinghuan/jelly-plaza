import type { CharacterConfig } from './types';

const BASE = import.meta.env.BASE_URL;

export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'isaya',
    name: 'Isaya',
    status: 'Drawing',
    statusEmoji: '🎨',
    mode: 'single',
    image: `${BASE}characters/isaya.png`,
    imageWidth: 832,
    imageHeight: 1248,
    x: 50,
    y: 45,
    scale: 0.26,
    greeting: '...working on a new piece',
  },
  {
    id: 'algram',
    name: 'Algram',
    status: 'Playing guitar',
    statusEmoji: '🎸',
    mode: 'single',
    image: `${BASE}characters/algram.png`,
    imageWidth: 928,
    imageHeight: 1120,
    x: 20,
    y: 55,
    scale: 0.28,
    greeting: 'Hey! Wanna jam together?',
  },
  {
    id: 'jenny',
    name: 'Jenny',
    status: 'Coding',
    statusEmoji: '💻',
    mode: 'single',
    image: `${BASE}characters/jenny.png`,
    imageWidth: 928,
    imageHeight: 1120,
    x: 78,
    y: 50,
    scale: 0.27,
    greeting: 'Just fixed a bug~',
  },
];
