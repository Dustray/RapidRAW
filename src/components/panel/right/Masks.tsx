import {
  Brush,
  BringToFront,
  Circle,
  Cloud,
  Droplet,
  Droplets,
  Eraser,
  MoreHorizontal,
  RectangleHorizontal,
  Sparkles,
  TriangleRight,
  User,
  Sun,
} from 'lucide-react';

export enum Mask {
  AiDepth = 'ai-depth',
  AiForeground = 'ai-foreground',
  AiSky = 'ai-sky',
  AiSubject = 'ai-subject',
  All = 'all',
  Brush = 'brush',
  Flow = 'flow',
  Color = 'color',
  Linear = 'linear',
  Luminance = 'luminance',
  QuickEraser = 'quick-eraser',
  Radial = 'radial',
}

export enum SubMaskMode {
  Additive = 'additive',
  Subtractive = 'subtractive',
  Intersect = 'intersect',
}

export enum ToolType {
  AiSeletor = 'ai-selector',
  Brush = 'brush',
  Eraser = 'eraser',
  GenerativeReplace = 'generative-replace',
  SelectSubject = 'select-subject',
}

export interface MaskType {
  disabled: boolean;
  icon: any;
  id?: string;
  name: string;
  type: Mask;
}

export interface SubMask {
  id: string;
  invert: boolean;
  mode: SubMaskMode;
  name?: string;
  opacity: number;
  parameters?: any;
  type: Mask;
  visible: boolean;
}

export function formatMaskTypeName(type: string) {
  if (type === Mask.AiDepth) return 'masks.types.depth';
  if (type === Mask.AiSubject) return 'masks.types.subject';
  if (type === Mask.AiForeground) return 'masks.types.foreground';
  if (type === Mask.AiSky) return 'masks.types.sky';
  if (type === Mask.All) return 'masks.types.wholeImage';
  if (type === Mask.QuickEraser) return 'masks.types.quickEraser';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function getSubMaskName(subMask: Pick<SubMask, 'name' | 'type'>) {
  return subMask.name?.trim() || formatMaskTypeName(subMask.type);
}

export const MASK_ICON_MAP: Record<Mask, any> = {
  [Mask.AiDepth]: BringToFront,
  [Mask.AiForeground]: User,
  [Mask.AiSky]: Cloud,
  [Mask.AiSubject]: Sparkles,
  [Mask.All]: RectangleHorizontal,
  [Mask.Brush]: Brush,
  [Mask.Flow]: Droplets,
  [Mask.Color]: Droplet,
  [Mask.Linear]: TriangleRight,
  [Mask.Luminance]: Sparkles,
  [Mask.QuickEraser]: Eraser,
  [Mask.Radial]: Circle,
};

export const MASK_PANEL_CREATION_TYPES: Array<MaskType> = [
  {
    disabled: false,
    icon: Sparkles,
    name: 'masks.types.subject',
    type: Mask.AiSubject,
  },
  {
    disabled: false,
    icon: Cloud,
    name: 'masks.types.sky',
    type: Mask.AiSky,
  },
  {
    disabled: false,
    icon: User,
    name: 'masks.types.foreground',
    type: Mask.AiForeground,
  },
  {
    disabled: false,
    icon: TriangleRight,
    name: 'masks.types.linear',
    type: Mask.Linear,
  },
  {
    disabled: false,
    icon: Circle,
    name: 'masks.types.radialType',
    type: Mask.Radial,
  },
  {
    disabled: false,
    icon: MoreHorizontal,
    id: 'others',
    name: 'masks.types.others',
    type: null,
  },
];

export const AI_PANEL_CREATION_TYPES: Array<MaskType> = [
  {
    disabled: false,
    icon: Eraser,
    name: 'masks.types.quickErase',
    type: Mask.QuickEraser,
  },
  {
    disabled: false,
    icon: Sparkles,
    name: 'masks.types.subject',
    type: Mask.AiSubject,
  },
  {
    disabled: false,
    icon: User,
    name: 'masks.types.foreground',
    type: Mask.AiForeground,
  },
  {
    disabled: false,
    icon: Brush,
    name: 'masks.brush',
    type: Mask.Brush,
  },
  {
    disabled: false,
    icon: TriangleRight,
    name: 'masks.types.linear',
    type: Mask.Linear,
  },
  {
    disabled: false,
    icon: Circle,
    name: 'masks.types.radialType',
    type: Mask.Radial,
  },
];

export const SUB_MASK_COMPONENT_TYPES: Array<MaskType> = [
  {
    disabled: false,
    icon: Sparkles,
    name: 'masks.types.subject',
    type: Mask.AiSubject,
  },
  {
    disabled: false,
    icon: Cloud,
    name: 'masks.types.sky',
    type: Mask.AiSky,
  },
  {
    disabled: false,
    icon: User,
    name: 'masks.types.foreground',
    type: Mask.AiForeground,
  },
  {
    disabled: false,
    icon: TriangleRight,
    name: 'masks.types.linear',
    type: Mask.Linear,
  },
  {
    disabled: false,
    icon: Circle,
    name: 'masks.types.radialType',
    type: Mask.Radial,
  },
  {
    disabled: false,
    icon: MoreHorizontal,
    id: 'others',
    name: 'masks.types.others',
    type: null,
  },
];

export const OTHERS_MASK_TYPES: Array<MaskType> = [
  {
    disabled: false,
    icon: BringToFront,
    name: 'masks.types.depth',
    type: Mask.AiDepth,
  },
  {
    disabled: false,
    icon: Droplet,
    name: 'Color',
    type: Mask.Color,
  },
  {
    disabled: false,
    icon: Sun,
    name: 'Luminance',
    type: Mask.Luminance,
  },
  {
    disabled: false,
    icon: Brush,
    name: 'masks.brush',
    type: Mask.Brush,
  },
  {
    disabled: false,
    icon: Droplets,
    name: 'Flow',
    type: Mask.Flow,
  },
  {
    disabled: false,
    icon: RectangleHorizontal,
    name: 'masks.types.wholeImage',
    type: Mask.All,
  },
];

export const AI_SUB_MASK_COMPONENT_TYPES: Array<MaskType> = [
  {
    disabled: false,
    icon: Sparkles,
    name: 'masks.types.subject',
    type: Mask.AiSubject,
  },
  {
    disabled: false,
    icon: User,
    name: 'masks.types.foreground',
    type: Mask.AiForeground,
  },
  {
    disabled: false,
    icon: Brush,
    name: 'masks.brush',
    type: Mask.Brush,
  },
  {
    disabled: false,
    icon: TriangleRight,
    name: 'masks.types.linear',
    type: Mask.Linear,
  },
  {
    disabled: false,
    icon: Circle,
    name: 'masks.types.radialType',
    type: Mask.Radial,
  },
];
