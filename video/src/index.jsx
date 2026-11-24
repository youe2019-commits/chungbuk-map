import {registerRoot, Composition} from 'remotion';
import {ChungbukIntro, TOTAL_FRAMES} from './ChungbukIntro.jsx';

const Root = () => (
  <Composition
    id="ChungbukIntro"
    component={ChungbukIntro}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={TOTAL_FRAMES}
  />
);

registerRoot(Root);
