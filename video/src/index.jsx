import {registerRoot, Composition} from 'remotion';
import {ChungbukIntro, TOTAL_FRAMES} from './ChungbukIntro.jsx';
import {ChungbukTrailer, TRAILER_FRAMES} from './Trailer.jsx';

const Root = () => (
  <>
  <Composition
    id="ChungbukIntro"
    component={ChungbukIntro}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={TOTAL_FRAMES}
  />
  <Composition
    id="ChungbukTrailer"
    component={ChungbukTrailer}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={TRAILER_FRAMES}
  />
  </>
);

registerRoot(Root);
