import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useDrishti } from '../store/useDrishti';

/**
 * One effect that serves the ore, nothing that serves itself. If the whole scene glows,
 * intensity is wrong — halve it before adding anything else (Part I §3).
 */
export function Effects() {
  const { gl } = useThree();
  const view = useDrishti((s) => s.view);
  const [softwareRenderer, setSoftwareRenderer] = useState(false);

  useEffect(() => {
    const ctx = gl.getContext();
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const renderer = ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
      if (/swiftshader|software|llvmpipe/i.test(renderer)) {
        setSoftwareRenderer(true);
        console.warn('[DRISHTI] Software renderer detected, disabling bloom:', renderer);
      }
    }
  }, [gl]);

  if (softwareRenderer || (view !== 'BLOCK' && view !== 'SUBSURFACE')) return null;

  return (
    <EffectComposer>
      <Bloom intensity={0.65} luminanceThreshold={0.62} radius={0.7} mipmapBlur />
      <Vignette darkness={0.55} />
    </EffectComposer>
  );
}
