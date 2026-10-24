import { ArrowRight } from "lucide-react";

export function JourneyIntro() {
  return <section className="intro" aria-labelledby="journey-intro-title">
    <div className="intro-copy">
      <h1 id="journey-intro-title"><span>Let the road</span><span>teach you.</span></h1>
      <p className="lede">30hours turns your route into a spoken lesson timed to end when you arrive.</p>
      <a className="intro-action" href="#journey-planner">
        <span>Start my journey</span><ArrowRight size={19} aria-hidden="true" />
      </a>
    </div>

    <figure className="intro-art" aria-hidden="true">
      <svg className="intro-route" viewBox="0 0 580 390" role="presentation" focusable="false">
        <path id="intro-route-line" className="intro-road-edge" d="M46 178 C52 102 124 61 182 81 C240 99 236 158 181 175 C130 191 74 194 58 241 C34 311 123 333 187 293 C237 262 239 208 208 195 C259 201 301 230 328 266 C357 303 421 320 463 285 C508 250 502 147 458 111 C419 79 365 96 355 143 C344 190 368 256 415 261 C445 264 468 244 484 219" />
        <path className="intro-road-center" d="M46 178 C52 102 124 61 182 81 C240 99 236 158 181 175 C130 191 74 194 58 241 C34 311 123 333 187 293 C237 262 239 208 208 195 C259 201 301 230 328 266 C357 303 421 320 463 285 C508 250 502 147 458 111 C419 79 365 96 355 143 C344 190 368 256 415 261 C445 264 468 244 484 219" />
        <circle className="intro-origin" cx="46" cy="178" r="8" />
        <circle className="intro-checkpoint intro-checkpoint-one" cx="150" cy="127" r="6" />
        <circle className="intro-checkpoint intro-checkpoint-two" cx="119" cy="311" r="6" />
        <circle className="intro-checkpoint intro-checkpoint-three" cx="404" cy="294" r="6" />
        <circle className="intro-arrival-ring" cx="484" cy="219" r="16" />
        <circle className="intro-arrival" cx="484" cy="219" r="8" />
        <circle className="intro-drive-cursor" r="7">
          <animateMotion dur="24s" repeatCount="indefinite" rotate="auto">
            <mpath href="#intro-route-line" />
          </animateMotion>
        </circle>
      </svg>
    </figure>
  </section>;
}
