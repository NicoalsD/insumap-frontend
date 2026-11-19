import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { RefObject } from 'react';
import { ENTRANCE, FLOW_LINE, REVEAL } from './art/motion';

gsap.registerPlugin(useGSAP, ScrollTrigger);
// The 3D scenes can make a frame slow on modest devices; without this GSAP would stretch the
// entrance in time instead of finishing it when it should.
gsap.ticker.lagSmoothing(0);

/**
 * One orchestrated motion for the page: the hero copy rises line by line, sections reveal as
 * they enter and the patient flow line draws once across its steps. Content is visible by default;
 * with reduced motion nothing moves.
 */
export function useLandingMotion(scope: RefObject<HTMLElement | null>): void {
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-hero-rise]', {
          y: ENTRANCE.rise,
          autoAlpha: 0,
          duration: ENTRANCE.duration,
          ease: 'expo.out',
          stagger: ENTRANCE.stagger,
        });

        for (const group of gsap.utils.toArray<HTMLElement>('[data-reveal-group]')) {
          gsap.from(group.querySelectorAll('[data-reveal]'), {
            y: REVEAL.rise,
            autoAlpha: 0,
            duration: REVEAL.duration,
            ease: 'expo.out',
            stagger: REVEAL.stagger,
            scrollTrigger: { trigger: group, start: REVEAL.start, once: true },
          });
        }

        // Drawn once, start to finish, when the steps arrive: never left half-way while reading.
        gsap.from('.lp-flow__line', {
          scaleX: 0,
          duration: FLOW_LINE.duration,
          ease: 'expo.inOut',
          scrollTrigger: { trigger: '.lp-flow', start: FLOW_LINE.start, once: true },
        });
      });
      return () => {
        media.revert();
      };
    },
    { scope },
  );
}
