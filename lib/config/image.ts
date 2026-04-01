export interface ImageOptions {
  ratio: string;      // e.g. '3:4', '16:9', '1:1'
  resolution: string; // '1k' | '2k' | '4k'
}

export const IMAGE_DEFAULTS: ImageOptions = {
  ratio: '3:4',
  resolution: '4k',
};
