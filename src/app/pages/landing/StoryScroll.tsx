import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Activity, ListOrdered, Smartphone, type LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import { es } from '@/i18n/es';
import type { BodyScene } from './art/bodyScene';
import { STORY_STEP_VIEWS } from './art/motion';
import { BodyCanvas } from './BodyCanvas';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STEP_ICONS: readonly LucideIcon[] = [Smartphone, Activity, ListOrdered];


/**
 * Scroll story: the body stays pinned (CSS sticky) while three steps scroll past; the scroll drives
 * the camera from the whole body to the sensor, into the bloodstream and back out. With reduced
 * motion the camera jumps between the step views instead of travelling.
 */
export function StoryScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<BodyScene | null>(null);
  const steps = es.landing.story.steps;

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      const reduced = prefersReducedMotion();
      const items = gsap.utils.toArray<HTMLElement>('.lp-story__step');
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate(self) {
          const active = Math.min(items.length - 1, Math.floor(self.progress * items.length));
          items.forEach((item, index) => {
            item.toggleAttribute('data-active', index === active);
          });
          // Reduced motion jumps to each step's view (sensor, vessel, back out) instead of travelling.
          const progress = reduced ? (STORY_STEP_VIEWS[active] ?? self.progress) : self.progress;
          sceneRef.current?.setProgress(progress);
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section ref={sectionRef} id="como-funciona" className="lp-story" aria-labelledby="lp-story-title">
      <div className="lp-section lp-story__grid">
        <div className="lp-story__copy">
          <h2 id="lp-story-title" className="lp-section__title lp-story__title" data-reveal>
            {es.landing.story.title}
          </h2>
          <ol className="lp-story__steps">
            {steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Activity;
              return (
                <li key={step.title} className="lp-story__step" data-active={index === 0 ? '' : undefined}>
                  <span className="lp-story__icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={2.25} />
                  </span>
                  <h3 className="lp-story__step-title">{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="lp-story__stage">
          <BodyCanvas
            mode="story"
            label={es.landing.scene.storyLabel}
            className="lp-story__canvas"
            onScene={(scene) => {
              sceneRef.current = scene;
            }}
          />
        </div>
      </div>
    </section>
  );
}
