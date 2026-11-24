import {registerRoot, Composition} from 'remotion';
import {ChungbukIntro} from './ChungbukIntro.jsx';

const Root = () => (
  <Composition
    id="ChungbukIntro"
    component={ChungbukIntro}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={4200}
  />
);

registerRoot(Root);
