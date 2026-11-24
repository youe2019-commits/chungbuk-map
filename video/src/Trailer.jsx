import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

// 충북 지도 1분 홍보 트레일러 (학생·학부모 대상)
// 누가 쓰는지 → 무엇이 좋은지 → 기능 몽타주 → QR 코드로 마무리
// 사진은 public/trailer/ (지금 앱을 컴퓨터 1280×800, 휴대폰 390×844로 촬영)

const FONT = '"Noto Sans CJK KR", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
const C = {
  bg: '#f4f2ea',
  ink: '#1c2a23',
  sub: '#55635a',
  green: '#22574a',
  teal: '#4a8090',
  mint: '#c6dcbc',
  paper: '#fffffc',
  heart: '#e0483e',
};

const FPS = 30;
const s = (sec) => Math.round(sec * FPS);
const ease = Easing.inOut(Easing.cubic);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};

const appear = (f, start, len = 14) => interpolate(f, [start, start + len], [0, 1], clamp);
const fade = (f, dur, len = 12) => interpolate(f, [0, len, dur - len, dur], [0, 1, 1, 0], clamp);
const rise = (op, px = 24) => `translateY(${(1 - op) * px}px)`;

// 장면 시간표 (초)
const ORDER = [
  ['hook', 4],
  ['who', 10],
  ['good', 10],
  ['montage', 26],
  ['end', 10],
];
const SCENES = {};
ORDER.reduce((at, [name, sec]) => {
  SCENES[name] = [s(at), s(sec)];
  return at + sec;
}, 0);
export const TRAILER_FRAMES = s(ORDER.reduce((sum, [, sec]) => sum + sec, 0));

// ───────── 화면 사진 (확대·이동) ─────────

// cam: 사진 좌표(컴퓨터 1280×800, 휴대폰 390×844)에서 보여 줄 가운데와 너비
const camAt = (f, keys) => {
  const frames = keys.map((k) => s(k.t));
  const pick = (name) =>
    frames.length === 1 ? keys[0][name] : interpolate(f, frames, keys.map((k) => k[name]), {easing: ease, ...clamp});
  return {cx: pick('cx'), cy: pick('cy'), w: pick('w')};
};

const Shot = ({src, src2, mix = 0, size, cam, width, height}) => {
  const k = width / cam.w;
  const tx = width / 2 - cam.cx * k;
  const ty = height / 2 - cam.cy * k;
  const img = {position: 'absolute', left: 0, top: 0, width: size[0], height: size[1]};
  return (
    <div style={{width, height, position: 'relative', overflow: 'hidden', background: '#dfe1da'}}>
      <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${k})`}}>
        <Img src={staticFile(src)} style={img} />
        {src2 ? <Img src={staticFile(src2)} style={{...img, opacity: mix}} /> : null}
      </div>
    </div>
  );
};

const Laptop = ({children, width}) => (
  <div style={{width: width + 28, padding: 14, borderRadius: 26, background: C.ink, boxShadow: '0 30px 70px rgba(20,40,30,.28)'}}>
    <div style={{borderRadius: 12, overflow: 'hidden'}}>{children}</div>
  </div>
);

const Phone = ({children, width}) => (
  <div style={{width: width + 28, padding: 14, borderRadius: 52, background: C.ink, boxShadow: '0 30px 70px rgba(20,40,30,.28)'}}>
    <div style={{borderRadius: 40, overflow: 'hidden'}}>{children}</div>
  </div>
);

// ───────── 간단한 아이콘 ─────────

const Icon = ({type, size = 84}) => {
  const st = {fill: 'none', stroke: '#fff', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round'};
  return (
    <div style={{width: size, height: size, borderRadius: 24, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 48 48">
        {type === 'student' && (
          <>
            <path {...st} d="M4 18 24 9l20 9-20 9z" />
            <path {...st} d="M12 22v10c0 3 6 6 12 6s12-3 12-6V22" />
            <path {...st} d="M44 18v12" />
          </>
        )}
        {type === 'parent' && (
          <>
            <path {...st} d="M6 22 24 8l18 14" />
            <path {...st} d="M11 19v21h26V19" />
            <path {...st} d="M20 40V29h8v11" />
          </>
        )}
        {type === 'teacher' && (
          <>
            <rect {...st} x="5" y="8" width="38" height="24" rx="2" />
            <path {...st} d="M12 16h14M12 23h20" />
            <path {...st} d="M18 32l-5 9M30 32l5 9" />
          </>
        )}
        {type === 'link' && (
          <>
            <rect {...st} x="14" y="5" width="20" height="38" rx="4" />
            <path {...st} d="M21 37h6" />
          </>
        )}
        {type === 'map' && (
          <>
            <path {...st} d="M5 11l12-5 14 5 12-5v31l-12 5-14-5-12 5z" />
            <path {...st} d="M17 6v31M31 11v31" />
          </>
        )}
        {type === 'heart' && (
          <path
            {...st}
            d="M24 41S6 30 6 17.5C6 11.7 10.5 7 16 7c3.5 0 6.4 1.9 8 4.7C25.6 8.9 28.5 7 32 7c5.5 0 10 4.7 10 10.5C42 30 24 41 24 41z"
          />
        )}
      </svg>
    </div>
  );
};

// ───────── 0:00–0:04 질문으로 시작 ─────────

const Hook = () => {
  const f = useCurrentFrame();
  const dur = SCENES.hook[1];
  const cam = camAt(f, [
    {t: 0, cx: 640, cy: 400, w: 1280},
    {t: 4, cx: 470, cy: 420, w: 900},
  ]);
  const q = appear(f, 6, 16);
  const tag = appear(f, s(1.8), 14);
  return (
    <AbsoluteFill style={{opacity: fade(f, dur, 10)}}>
      <Shot src="trailer/overview.webp" size={[1280, 800]} cam={cam} width={1920} height={1200} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(244,242,234,.15) 0%, rgba(244,242,234,.88) 58%, rgba(244,242,234,.96) 100%)'}} />
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 170}}>
        <div style={{fontSize: 96, fontWeight: 800, color: C.ink, opacity: q, transform: rise(q, 30), letterSpacing: -2}}>
          우리 동네엔 어떤 학교가 있을까?
        </div>
        <div style={{marginTop: 26, fontSize: 40, fontWeight: 700, color: C.green, opacity: tag, transform: rise(tag)}}>
          충북 학교를 지도에서 찾는 ‘충북 지도’
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────── 0:04–0:14 누가 쓰나요 ─────────

const PEOPLE = [
  ['student', '중학생', '진학할 고등학교를 우리 지역에서 찾아요', 1.2],
  ['parent', '학부모', '우리 동네 학교 위치와 종류를 한눈에 봐요', 3.2],
  ['teacher', '선생님', '사회 수업에서 지역과 인구를 함께 다뤄요', 5.2],
];

const Who = () => {
  const f = useCurrentFrame();
  const dur = SCENES.who[1];
  const title = appear(f, 4);
  const phone = appear(f, s(0.6), 18);
  const cam = camAt(f, [
    {t: 0, cx: 195, cy: 470, w: 390},
    {t: 10, cx: 195, cy: 470, w: 330},
  ]);
  return (
    <AbsoluteFill style={{background: C.bg, opacity: fade(f, dur)}}>
      <div style={{position: 'absolute', left: 120, top: 110, opacity: title, transform: rise(title)}}>
        <div style={{fontSize: 34, fontWeight: 700, color: C.teal}}>누가 쓰나요?</div>
        <div style={{fontSize: 68, fontWeight: 800, color: C.ink, marginTop: 8, letterSpacing: -1.5}}>
          충북의 학생·학부모·선생님
        </div>
      </div>
      <div style={{position: 'absolute', left: 120, top: 330, display: 'flex', flexDirection: 'column', gap: 34, width: 1020}}>
        {PEOPLE.map(([icon, who, text, at]) => {
          const op = appear(f, s(at), 16);
          return (
            <div
              key={who}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 34,
                padding: '28px 36px',
                borderRadius: 28,
                background: C.paper,
                boxShadow: '0 10px 30px rgba(30,60,45,.10)',
                opacity: op,
                transform: `translateX(${(1 - op) * -60}px)`,
              }}
            >
              <Icon type={icon} />
              <div>
                <div style={{fontSize: 46, fontWeight: 800, color: C.green}}>{who}</div>
                <div style={{fontSize: 36, fontWeight: 600, color: C.ink, marginTop: 4}}>{text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', right: 150, top: 120, opacity: phone, transform: rise(phone, 40)}}>
        <Phone width={390}>
          <Shot src="trailer/mobile-overview.webp" size={[390, 844]} cam={cam} width={390} height={812} />
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

// ───────── 0:14–0:24 무엇이 좋은가요 ─────────

const GOODS = [
  ['link', '설치 없이, 주소 하나로', '휴대폰·컴퓨터 어디서나 바로 열려요', 1],
  ['map', '인구와 학교를 한 지도에', '읍·면·동 153곳 인구밀도 위에 학교 위치', 3.2],
  ['heart', '관심 학교를 찜해서 모아 보기', '길게 눌러 찜하고, 목록에서 순서를 정리해요', 5.4],
];

const Good = () => {
  const f = useCurrentFrame();
  const dur = SCENES.good[1];
  const title = appear(f, 4);
  const laptop = appear(f, s(0.4), 18);
  // 장점에 맞춰 화면을 바꾼다: 전체 지도 → 지역 선택 → 찜한 학교
  const m1 = appear(f, s(3.2), 18);
  const m2 = appear(f, s(5.4), 18);
  const cam = camAt(f, [
    {t: 0, cx: 640, cy: 400, w: 1280},
    {t: 10, cx: 640, cy: 410, w: 1180},
  ]);
  const base = m1 < 1 ? 'trailer/overview.webp' : 'trailer/select.webp';
  const top = m1 < 1 ? 'trailer/select.webp' : 'trailer/favorites.webp';
  const mix = m1 < 1 ? m1 : m2;
  return (
    <AbsoluteFill style={{background: C.bg, opacity: fade(f, dur)}}>
      <div style={{position: 'absolute', left: 120, top: 110, opacity: title, transform: rise(title)}}>
        <div style={{fontSize: 34, fontWeight: 700, color: C.teal}}>무엇이 좋은가요?</div>
        <div style={{fontSize: 68, fontWeight: 800, color: C.ink, marginTop: 8, letterSpacing: -1.5}}>
          한 지도에서 보고, 찾고, 고르기
        </div>
      </div>
      <div style={{position: 'absolute', left: 120, top: 340, display: 'flex', flexDirection: 'column', gap: 44, width: 760}}>
        {GOODS.map(([icon, head, text, at], i) => {
          const op = appear(f, s(at), 16);
          return (
            <div key={head} style={{display: 'flex', alignItems: 'center', gap: 30, opacity: op, transform: rise(op)}}>
              <Icon type={icon} size={92} />
              <div>
                <div style={{fontSize: 48, fontWeight: 800, color: C.ink, letterSpacing: -1}}>
                  <span style={{color: C.teal, marginRight: 14}}>{i + 1}</span>
                  {head}
                </div>
                <div style={{fontSize: 32, fontWeight: 500, color: C.sub, marginTop: 6}}>{text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', right: 90, top: 300, opacity: laptop, transform: rise(laptop, 40)}}>
        <Laptop width={880}>
          <Shot src={base} src2={top} mix={mix} size={[1280, 800]} cam={cam} width={880} height={550} />
        </Laptop>
      </div>
    </AbsoluteFill>
  );
};

// ───────── 0:24–0:50 기능 몽타주 ─────────

const CLIPS = [
  {
    step: '인구 보기',
    text: '읍·면·동 153곳 인구밀도로, 사람이 많은 곳을 한눈에',
    src: 'trailer/overview.webp',
    device: 'laptop',
    cam: [
      {t: 0, cx: 640, cy: 400, w: 1280},
      {t: 4.3, cx: 440, cy: 410, w: 620},
    ],
  },
  {
    step: '학교 분포 보기',
    text: '지역을 누르면 읍·면이 떠오르고 학교가 나타나요',
    src: 'trailer/select-lift.webp',
    src2: 'trailer/select.webp',
    swap: [1.8, 2.6],
    device: 'laptop',
    cam: [
      {t: 0, cx: 640, cy: 400, w: 1280},
      {t: 4.3, cx: 700, cy: 360, w: 1000},
    ],
  },
  {
    step: '학교 분포 보기',
    text: '읍·면을 누르면 그곳 학교만 골라 보여요',
    src: 'trailer/danyang-pick.webp',
    device: 'laptop',
    cam: [
      {t: 0, cx: 640, cy: 420, w: 1280},
      {t: 4.3, cx: 500, cy: 560, w: 760},
    ],
  },
  {
    step: '관심 학교 고르기',
    text: '학교 카드를 길게 누르면 찜! 하트로 바로 알려 줘요',
    src: 'trailer/heart-hold.webp',
    src2: 'trailer/heart-saved.webp',
    swap: [2.4, 2.9],
    device: 'phone',
    cam: [
      {t: 0, cx: 195, cy: 470, w: 390},
      {t: 1.8, cx: 120, cy: 440, w: 230},
      {t: 4.3, cx: 120, cy: 440, w: 230},
    ],
  },
  {
    step: '관심 학교 고르기',
    text: '찜한 학교만 지도 위에 모아서 비교해요',
    src: 'trailer/favorites.webp',
    device: 'laptop',
    cam: [
      {t: 0, cx: 640, cy: 400, w: 1280},
      {t: 4.3, cx: 560, cy: 390, w: 900},
    ],
  },
  {
    step: '관심 학교 고르기',
    text: '찜 목록에서 순서를 바꾸고, 필요 없는 학교는 빼요',
    src: 'trailer/list.webp',
    device: 'laptop',
    cam: [
      {t: 0, cx: 640, cy: 400, w: 1280},
      {t: 4.3, cx: 640, cy: 415, w: 620},
    ],
  },
];
const CLIP = SCENES.montage[1] / CLIPS.length;

const Clip = ({clip, index}) => {
  const f = useCurrentFrame();
  const op = fade(f, Math.round(CLIP), 9);
  const cap = appear(f, 4, 12);
  const cam = camAt(f, clip.cam);
  const mix = clip.swap ? interpolate(f, [s(clip.swap[0]), s(clip.swap[1])], [0, 1], clamp) : 0;
  const laptop = clip.device === 'laptop';
  return (
    <AbsoluteFill style={{background: C.bg, opacity: op}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 56, display: 'flex', justifyContent: 'center', opacity: cap, transform: rise(cap, 16)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
          <span style={{padding: '8px 22px', borderRadius: 999, background: C.green, color: '#fff', fontSize: 30, fontWeight: 700}}>
            {clip.step}
          </span>
          <span style={{fontSize: 50, fontWeight: 800, color: C.ink, letterSpacing: -1}}>{clip.text}</span>
        </div>
      </div>
      <AbsoluteFill style={{top: 170, alignItems: 'center', justifyContent: 'flex-start'}}>
        {laptop ? (
          <Laptop width={1300}>
            <Shot src={clip.src} src2={clip.src2} mix={mix} size={[1280, 800]} cam={cam} width={1300} height={812} />
          </Laptop>
        ) : (
          <div style={{display: 'flex', alignItems: 'center', gap: 80}}>
            <Phone width={400}>
              <Shot src={clip.src} src2={clip.src2} mix={mix} size={[390, 844]} cam={cam} width={400} height={820} />
            </Phone>
            <div style={{width: 560}}>
              <HeartSteps f={f} mix={mix} />
            </div>
          </div>
        )}
      </AbsoluteFill>
      <div style={{position: 'absolute', right: 70, bottom: 40, fontSize: 26, fontWeight: 700, color: C.sub}}>
        {index + 1} / {CLIPS.length}
      </div>
    </AbsoluteFill>
  );
};

const HeartSteps = ({f, mix}) => {
  const a = appear(f, s(0.8));
  const b = appear(f, s(2.6));
  const row = (op, on, big, text) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 24, opacity: op, transform: rise(op)}}>
      <svg width={big ? 76 : 44} height={big ? 76 : 44} viewBox="0 0 48 48" style={{flexShrink: 0}}>
        <path
          fill={on ? C.heart : '#d9dcd6'}
          d="M24 41S6 30 6 17.5C6 11.7 10.5 7 16 7c3.5 0 6.4 1.9 8 4.7C25.6 8.9 28.5 7 32 7c5.5 0 10 4.7 10 10.5C42 30 24 41 24 41z"
        />
      </svg>
      <div style={{fontSize: 40, fontWeight: 700, color: on ? C.ink : C.sub}}>{text}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 46}}>
      {row(a, mix < 0.5, true, '누르는 동안 하트가 커지면')}
      {row(b, mix >= 0.5, false, '작아져 남으면 찜 완료!')}
    </div>
  );
};

const Montage = () => (
  <AbsoluteFill style={{background: C.bg}}>
    {CLIPS.map((clip, i) => (
      <Sequence key={i} from={Math.round(i * CLIP)} durationInFrames={Math.round(CLIP)}>
        <Clip clip={clip} index={i} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

// ───────── 0:50–1:00 QR 코드로 마무리 ─────────

const End = () => {
  const f = useCurrentFrame();
  const dur = SCENES.end[1];
  const a = appear(f, 4, 16);
  const b = appear(f, s(1), 16);
  const qr = appear(f, s(1.6), 18);
  const pulse = 1 + 0.025 * Math.sin((f / FPS) * Math.PI * 1.2) * appear(f, s(3), 20);
  return (
    <AbsoluteFill style={{background: C.bg, opacity: interpolate(f, [0, 12], [0, 1], clamp)}}>
      <div style={{position: 'absolute', left: 150, top: 230, width: 1000}}>
        <div style={{fontSize: 40, fontWeight: 700, color: C.teal, opacity: a, transform: rise(a)}}>
          인구를 보고, 학교를 찾고, 관심 학교를 고르는
        </div>
        <div style={{fontSize: 150, fontWeight: 900, color: C.green, letterSpacing: -4, marginTop: 6, opacity: a, transform: rise(a, 30)}}>
          충북 지도
        </div>
        <div style={{fontSize: 36, fontWeight: 600, color: C.ink, marginTop: 30, lineHeight: 1.5, opacity: b, transform: rise(b)}}>
          충북 학생·학부모·선생님을 위한 우리 지역 학교 지도
        </div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 40,
            padding: '16px 30px',
            borderRadius: 16,
            background: C.paper,
            boxShadow: '0 6px 20px rgba(30,60,45,.08)',
            fontSize: 34,
            fontWeight: 700,
            color: C.green,
            opacity: b,
            transform: rise(b),
          }}
        >
          youe2019-commits.github.io/chungbuk-map/dist/
        </div>
      </div>
      <div style={{position: 'absolute', right: 170, top: 200, textAlign: 'center', opacity: qr, transform: `${rise(qr, 30)} scale(${pulse})`}}>
        <div style={{padding: 26, borderRadius: 32, background: '#fff', boxShadow: '0 24px 60px rgba(20,40,30,.18)'}}>
          <Img src={staticFile('trailer/qr.png')} style={{width: 480, height: 480, display: 'block'}} />
        </div>
        <div style={{marginTop: 26, fontSize: 36, fontWeight: 800, color: C.ink}}>휴대폰 카메라로 비춰 보세요</div>
        <div style={{marginTop: 6, fontSize: 28, fontWeight: 500, color: C.sub}}>설치 없이 바로 열려요</div>
      </div>
    </AbsoluteFill>
  );
};

// ───────── 전체 ─────────

const PARTS = {hook: Hook, who: Who, good: Good, montage: Montage, end: End};

export const ChungbukTrailer = () => (
  <AbsoluteFill style={{background: C.bg, fontFamily: FONT, wordBreak: 'keep-all'}}>
    {ORDER.map(([name]) => {
      const Part = PARTS[name];
      return (
        <Sequence key={name} from={SCENES[name][0]} durationInFrames={SCENES[name][1]}>
          <Part />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
