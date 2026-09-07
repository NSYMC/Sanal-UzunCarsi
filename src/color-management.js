import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves.js';

export const TOUR_EXPOSURE = Object.freeze({ outside: 0.58, inside: 0.54 });

// glTF base colors stay linear and unchanged. This display adjustment is not
// Blender's AgX: it uses Babylon's supported ACES transform with restrained chroma.
export const configureColorManagement = (scene, { exposure = 1 } = {}) => {
    const image = scene.imageProcessingConfiguration;
    image.toneMappingEnabled = true;
    image.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    image.exposure = exposure;
    image.contrast = 1;
    const curves = new ColorCurves();
    curves.globalSaturation = -12;
    curves.highlightsSaturation = -8;
    image.colorCurves = curves;
    image.colorCurvesEnabled = true;
    return image;
};
