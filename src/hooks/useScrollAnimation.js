
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useScrollAnimation() {
  const documents = useRef();
  const panels = useRef();
  const ripple = useRef();
  const diagnosis = useRef();
  const hope = useRef();

  useLayoutEffect(() => {
    if (
      !documents.current ||
      !panels.current ||
      !ripple.current ||
      !diagnosis.current ||
      !hope.current
    ) return;

    const ctx = gsap.context(() => {
      // Initial scene states
      gsap.set(diagnosis.current.scale, {
        x: 1, y: 1, z: 1
      });

      gsap.set(hope.current.scale, {
        x: 0.001, y: 0.001, z: 0.001
      });

      gsap.set(panels.current.scale, {
        x: 0.001, y: 0.001, z: 0.001
      });

      gsap.set(ripple.current.scale, {
        x: 0.15, y: 0.15, z: 0.15
      });

      gsap.set(ripple.current.children[0].material, {
        opacity: 0
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".story-section",
          start: "top top",
          end: "bottom bottom",
          scrub: 1.1,
          invalidateOnRefresh: true
        }
      });

      // Stage 1: Hospital uncertainty
      tl.to(documents.current.position, {
        y: -0.55,
        duration: 0.25
      }, 0.05);

      // Stage 2: Purple transformation ripple
      tl.to(ripple.current.scale, {
        x: 9,
        y: 9,
        z: 9,
        duration: 0.5,
        ease: "power2.out"
      }, 0.20);

      tl.to(ripple.current.children[0].material, {
        opacity: 0.85,
        duration: 0.15
      }, 0.20);

      // Stage 3: Busy hospital fades away
      tl.to(diagnosis.current.scale, {
        x: 0.001,
        y: 0.001,
        z: 0.001,
        duration: 0.25,
        ease: "power2.in"
      }, 0.43);

      // Stage 4: Neravu support ecosystem appears
      tl.to(hope.current.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.4,
        ease: "back.out(1.3)"
      }, 0.50);

      // Stage 5: Digital guidance panels appear
      tl.to(panels.current.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.35,
        ease: "back.out(1.2)"
      }, 0.67);

      tl.to(ripple.current.children[0].material, {
        opacity: 0.12,
        duration: 0.2
      }, 0.82);

    });

    return () => ctx.revert();
  }, []);

  return {
    documents,
    panels,
    ripple,
    diagnosis,
    hope
  };
}
