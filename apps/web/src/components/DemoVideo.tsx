import { demoVideo } from "@/content/demo";

/**
 * The launch demo video (parked.md #16), on the home page between the home screen and "Then say what to change.". Nothing
 * at all until `demoVideo` in content/demo.ts is set: no section, no heading, no space. Our own file in the browser's own
 * player (controls, captions, full screen), loaded only when pressed (`preload="none"`), so the home page stays as light as
 * it is today.
 */
export function DemoVideo() {
  if (!demoVideo) return null;
  return (
    <section className="section" id="video" aria-labelledby="video-title">
      <h2 id="video-title" className="title">
        Watch one game get made.
      </h2>
      <div className="widget widget--ink video">
        <video className="video__frame" src={demoVideo.src} poster={demoVideo.poster} controls preload="none" playsInline>
          {demoVideo.captions && <track kind="captions" src={demoVideo.captions} srcLang="en" label="English" default />}
        </video>
      </div>
    </section>
  );
}
