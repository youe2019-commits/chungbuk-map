import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

// 사진은 public/screens/ (video/README.md 참고)
// 컴퓨터 화면 1280×800, 휴대폰 화면 390×844

const FONT = '"Noto Sans CJK KR", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
const C = {
  bg: '#f4f2ea',
  ink: '#1c2a23',
  sub: '#5b675f',
  green: '#22574a',
  greenSoft: '#e1ece5',
  gray: '#7b817c',
  heart: '#e0483e',
  ring: '#f2b134',
};

const FPS = 30;
const s = (sec) => Math.round(sec * FPS);
const ease = Easing.inOut(Easing.cubic);

// 장면 시간표 (README 시나리오와 같은 순서·길이): 인구 보기 → 학교 분포 보기 → 관심 학교 고르기
const ORDER = [
  ['intro', 12],
  ['density', 24],
  ['select', 22],
  ['danyang', 16],
  ['city', 22],
  ['heart', 26],
  ['cards', 24],
  ['list', 20],
  ['outro', 12],
];
const SCENES = {};
ORDER.reduce((at, [name, sec]) => {
  SCENES[name] = [s(at), s(sec)];
  return at + sec;
}, 0);
export const TOTAL_FRAMES = s(ORDER.reduce((sum, [, sec]) => sum + sec, 0));
const STAGES = ['', '1단계 인구 보기', '2단계 학교 분포 보기', '3단계 관심 학교 고르기'];

// ───────── 공통 도우미 ─────────

const fade = (f, dur, len = 15) =>
  interpolate(f, [0, len, dur - len, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const appear = (f, start, len = 15) =>
  interpolate(f, [start, start + len], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// 카메라 키프레임 [{t: 초, cx, cy, w}] → 지금 프레임의 카메라
const camAt = (f, keys) => {
  const frames = keys.map((k) => s(k.t));
  const pick = (name) =>
    frames.length === 1
      ? keys[0][name]
      : interpolate(f, frames, keys.map((k) => k[name]), {
          easing: ease,
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
  return {cx: pick('cx'), cy: pick('cy'), w: pick('w')};
};

// ───────── 비교 화면 패널 ─────────

const PW = 900;
const PH = 562;

// 이미지 좌표의 강조 원 (화면에서 크기가 일정하도록 배율로 나눔)
const Ring = ({x, y, r = 34, scale, opacity = 1, color = C.ring}) => (
  <div
    style={{
      position: 'absolute',
      left: x - r / scale,
      top: y - r / scale,
      width: (2 * r) / scale,
      height: (2 * r) / scale,
      borderRadius: '50%',
      border: `${5 / scale}px solid ${color}`,
      boxShadow: `0 0 ${14 / scale}px ${color}`,
      opacity,
    }}
  />
);

const Panel = ({src, size, cam, label, after, overlay, src2, mix = 0}) => {
  const k = PW / cam.w;
  const tx = PW / 2 - cam.cx * k;
  const ty = PH / 2 - cam.cy * k;
  return (
    <div style={{width: PW}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          fontSize: 30,
          fontWeight: 700,
          color: after ? C.green : C.gray,
        }}
      >
        <span
          style={{
            padding: '4px 18px',
            borderRadius: 999,
            background: after ? C.green : '#d9dbd6',
            color: after ? '#fff' : '#3d433f',
          }}
        >
          {after ? '고친 후' : '고치기 전'}
        </span>
        <span style={{fontSize: 26, fontWeight: 500, color: C.sub}}>{label}</span>
      </div>
      <div
        style={{
          width: PW,
          height: PH,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 20,
          background: '#dcdcd4',
          boxShadow: after
            ? `0 0 0 4px ${C.green}, 0 12px 30px rgba(0,0,0,.18)`
            : '0 0 0 2px #c9ccc6, 0 12px 30px rgba(0,0,0,.12)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size[0],
            height: size[1],
            transformOrigin: '0 0',
            transform: `translate(${tx}px, ${ty}px) scale(${k})`,
          }}
        >
          <Img src={staticFile(src)} style={{width: size[0], height: size[1], display: 'block'}} />
          {src2 ? (
            <Img
              src={staticFile(src2)}
              style={{position: 'absolute', left: 0, top: 0, width: size[0], height: size[1], opacity: mix}}
            />
          ) : null}
          {overlay ? overlay(k) : null}
        </div>
      </div>
    </div>
  );
};

// 장면 제목 + 요청 인용 + 바꾼 이유 자막
const CompareFrame = ({f, dur, no, stage, title, request, reasons, left, right, callout}) => {
  const qOp = appear(f, s(1.5));
  // 요청이 여러 개이면 [원문, 시작 초] 순서대로 바꿔 보여 준다.
  const requests = Array.isArray(request) ? request : [[request, 0]];
  const current = requests.filter(([, at]) => f >= s(at)).pop() || requests[0];
  const swap = appear(f, s(current[1]), 12);
  const requestText = current[0];
  const longRequest = requestText.length > 42;
  return (
    <AbsoluteFill style={{background: C.bg, opacity: fade(f, dur)}}>
      {/* 제목 */}
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <span
          style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            background: C.green,
            color: '#fff',
            fontSize: 32,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {no}
        </span>
        <span style={{fontSize: 44, fontWeight: 800, color: C.ink}}>{title}</span>
      </div>
      <div style={{position: 'absolute', right: 44, top: 40, fontSize: 26, color: C.sub, fontWeight: 600}}>
        {STAGES[stage]} · {no}/7
      </div>

      {/* 좌우 비교 */}
      <div style={{position: 'absolute', left: 40, top: 104, display: 'flex', gap: 40}}>
        <Panel {...left} />
        <Panel {...right} after />
      </div>

      {callout}

      {/* 내가 AI에게 한 요청 */}
      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          top: 742,
          minHeight: 92,
          padding: '8px 0',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          borderRadius: 16,
          borderLeft: `10px solid ${C.green}`,
          boxShadow: '0 4px 14px rgba(0,0,0,.06)',
          opacity: qOp,
          transform: `translateY(${(1 - qOp) * 16}px)`,
        }}
      >
        <span style={{width: 290, paddingLeft: 26, fontSize: 26, fontWeight: 700, color: C.green}}>
          내가 AI에게 한 요청
        </span>
        <span
          style={{
            flex: 1,
            paddingRight: 30,
            fontSize: longRequest ? 30 : 38,
            lineHeight: 1.3,
            fontWeight: 700,
            color: C.ink,
            opacity: current === requests[0] ? 1 : swap,
          }}
        >
          {requests.length > 1 ? (
            <span style={{fontSize: 24, color: C.green, marginRight: 12}}>{'①②③'[requests.indexOf(current)]}</span>
          ) : null}
          {requestText}
        </span>
      </div>

      {/* 바꾼 이유 */}
      <div style={{position: 'absolute', left: 40, right: 40, top: 856, display: 'flex'}}>
        <span
          style={{
            width: 290,
            paddingLeft: 36,
            paddingTop: 8,
            fontSize: 26,
            fontWeight: 700,
            color: C.sub,
            flexShrink: 0,
          }}
        >
          바꾼 이유
        </span>
        <div style={{flex: 1}}>
          {reasons.map(([text, at], i) => {
            const op = appear(f, s(at));
            return (
              <div
                key={i}
                style={{
                  fontSize: 34,
                  lineHeight: 1.45,
                  fontWeight: 500,
                  color: C.ink,
                  marginBottom: 10,
                  opacity: op,
                  transform: `translateY(${(1 - op) * 12}px)`,
                }}
              >
                {text}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 패널 아래쪽 작은 안내 문구 (화면 좌표)
const Tag = ({x, y, text, op}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translateX(-50%)',
      padding: '6px 18px',
      borderRadius: 999,
      background: C.ink,
      color: '#fff',
      fontSize: 26,
      fontWeight: 700,
      opacity: op,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
);

// ───────── 도입 ─────────

const Intro = () => {
  const f = useCurrentFrame();
  const dur = SCENES.intro[1];
  const qMove = interpolate(f, [s(3.2), s(4.4)], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const qOp = appear(f, 6, 20);
  const shots = appear(f, s(3.6), 24);
  return (
    <AbsoluteFill style={{background: C.bg, opacity: fade(f, dur, 12)}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: interpolate(qMove, [0, 1], [440, 40]),
          textAlign: 'center',
          fontSize: interpolate(qMove, [0, 1], [76, 50]),
          fontWeight: 800,
          color: C.ink,
          opacity: qOp,
        }}
      >
        우리 지역에는 어떤 학교가 있고, 어디에 있을까요?
      </div>

      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 44,
          opacity: shots,
          transform: `translateY(${(1 - shots) * 30}px)`,
        }}
      >
        <Device label="컴퓨터">
          <Img src={staticFile('screens/map-desktop-density.webp')} style={{width: 1000, height: 625, display: 'block'}} />
        </Device>
        <Device label="휴대폰">
          <Img src={staticFile('screens/map-mobile-density.webp')} style={{width: 289, height: 625, display: 'block'}} />
        </Device>
      </div>

      <Caption
        lines={[
          ['충북 학생·학부모·교직원이 우리 지역의 학교를 쉽게 찾아보도록 만든 수업용 지도입니다.', s(5)],
          ['인구를 보고 → 학교가 어디에 있는지 살피고 → 관심 있는 학교를 고릅니다.', s(7)],
          ['직접 써 보면서 고친 일곱 장면을 소개합니다.', s(9)],
        ]}
        f={f}
      />
    </AbsoluteFill>
  );
};

const Device = ({label, children}) => (
  <div style={{textAlign: 'center'}}>
    <div
      style={{
        borderRadius: 22,
        overflow: 'hidden',
        border: `8px solid ${C.ink}`,
        boxShadow: '0 16px 40px rgba(0,0,0,.2)',
      }}
    >
      {children}
    </div>
    <div style={{marginTop: 10, fontSize: 26, fontWeight: 700, color: C.sub}}>{label}</div>
  </div>
);

const Caption = ({lines, f}) => (
  <div style={{position: 'absolute', left: 80, right: 80, top: 850, textAlign: 'center'}}>
    {lines.map(([text, at], i) => {
      const op = appear(f, at);
      return (
        <div
          key={i}
          style={{
            fontSize: 38,
            lineHeight: 1.5,
            fontWeight: i === 0 ? 700 : 500,
            color: C.ink,
            opacity: op,
            transform: `translateY(${(1 - op) * 12}px)`,
          }}
        >
          {text}
        </div>
      );
    })}
  </div>
);

// ───────── 3단계 ⑥ 찜한 학교 카드 위치 ─────────

const Cards = () => {
  const f = useCurrentFrame();
  const dur = SCENES.cards[1];
  // 전체 비교 → 옥천중 점에서 점선을 따라 왼쪽으로
  const cam = camAt(f, [
    {t: 0, cx: 640, cy: 400, w: 1280},
    {t: 8, cx: 640, cy: 400, w: 1280},
    {t: 10.5, cx: 470, cy: 600, w: 460},
    {t: 17, cx: 270, cy: 615, w: 540},
    {t: 22, cx: 270, cy: 615, w: 540},
  ]);
  const ringsAll = interpolate(f, [s(2), s(2.7), s(7.4), s(8)], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringOk = appear(f, s(11));
  const before = [
    [55, 357],
    [1218, 337],
    [55, 630],
  ];
  const after = [
    [401, 357],
    [627, 337],
    [392, 630],
  ];
  return (
    <CompareFrame
      f={f}
      dur={dur}
      no={6}
      stage={3}
      title="찜한 학교만 보기: 카드 위치"
      request="“점선을 짧게 해서 좀 더 가깝게 보이도록 하자.”"
      reasons={[
        ['학교를 여러 곳 찜하니 카드가 양끝으로 흩어졌습니다.', 2],
        ['카드와 지도 위 점을 가까이 두면 어느 학교인지 바로 연결해 볼 수 있습니다.', 11],
      ]}
      left={{
        src: 'screens/cards-before.webp',
        size: [1280, 800],
        cam,
        label: '카드가 지도 양쪽 끝에',
        overlay: (k) => (
          <>
            {before.map(([x, y], i) => (
              <Ring key={i} x={x} y={y} r={46} scale={k} opacity={ringsAll} />
            ))}
            <Ring x={457} y={615} r={30} scale={k} opacity={ringOk} />
          </>
        ),
      }}
      right={{
        src: 'screens/cards-after.webp',
        size: [1280, 800],
        cam,
        label: '카드가 학교 점 가까이',
        overlay: (k) => (
          <>
            {after.map(([x, y], i) => (
              <Ring key={i} x={x} y={y} r={46} scale={k} opacity={ringsAll} />
            ))}
            <Ring x={457} y={615} r={30} scale={k} opacity={ringOk} />
            <Ring x={392} y={630} r={50} scale={k} opacity={ringOk} />
          </>
        ),
      }}
      callout={
        <>
          <Tag x={490} y={624} text="옥천중 카드는 화면 끝에…" op={appear(f, s(14))} />
          <Tag x={1430} y={624} text="점 바로 옆에 옥천중" op={appear(f, s(14))} />
        </>
      }
    />
  );
};

// ───────── 3단계 ⑤ 찜하기: 누르는 동안의 하트 ─────────

const Heart = () => {
  const f = useCurrentFrame();
  const dur = SCENES.heart[1];
  const cam = camAt(f, [
    {t: 0, cx: 195, cy: 452, w: 390},
    {t: 3, cx: 195, cy: 452, w: 390},
    {t: 6.5, cx: 90, cy: 452, w: 170},
  ]);
  const press = interpolate(f, [s(4), s(4.5), s(15), s(15.6)], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pressLeft = interpolate(f, [s(4), s(4.5), s(22), s(22.5)], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const saved = interpolate(f, [s(15.2), s(16.2)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const Finger = ({k, op}) => (
    <div
      style={{
        position: 'absolute',
        left: 28 - 26 / k,
        top: 458 - 26 / k,
        width: 52 / k,
        height: 52 / k,
        borderRadius: '50%',
        background: 'rgba(40,80,200,.25)',
        border: `${3 / k}px solid rgba(40,80,200,.7)`,
        opacity: op,
      }}
    />
  );
  return (
    <CompareFrame
      f={f}
      dur={dur}
      no={5}
      stage={3}
      title="찜하기: 길게 누르는 동안의 하트"
      request="“하트가 등록되는 것(과정)이 보이도록.”"
      reasons={[
        ['처음에는 누르고 있어도 화면이 그대로였습니다.', 2],
        ['이제 하트가 커지면 터치가 인식된 걸 알고, 작아져 자리에 남으면 손을 떼도 됩니다.', 10],
      ]}
      left={{
        src: 'screens/heart-before.webp',
        size: [390, 844],
        cam,
        label: '증평중 카드를 누르는 중',
        overlay: (k) => <Finger k={k} op={pressLeft} />,
      }}
      right={{
        src: 'screens/heart-hold.webp',
        src2: 'screens/heart-saved.webp',
        mix: saved,
        size: [390, 844],
        cam,
        label: saved < 0.5 ? '누르는 중 → 하트가 커짐' : '등록 완료 → 작은 하트가 남음',
        overlay: (k) => <Finger k={k} op={press} />,
      }}
      callout={
        <>
          <Tag x={490} y={624} text="눌러도 변화 없음" op={appear(f, s(7.5))} />
          <Tag
            x={1430}
            y={624}
            text={saved < 0.5 ? '❤ 커진 하트: 인식됐어요' : '❤ 작아져 남음: 손을 떼도 돼요'}
            op={appear(f, s(7.5))}
          />
        </>
      }
    />
  );
};

// ───────── 3단계 ⑦ 찜 목록 정리 ─────────

const List = () => {
  const f = useCurrentFrame();
  const dur = SCENES.list[1];
  const cam = camAt(f, [
    {t: 0, cx: 640, cy: 400, w: 1280},
    {t: 2, cx: 640, cy: 400, w: 1280},
    {t: 5, cx: 640, cy: 420, w: 400},
  ]);
  const win = (a, b) =>
    interpolate(f, [s(a), s(a) + 8, s(b) - 8, s(b)], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  const up = win(7, 10);
  const down = win(10, 13);
  const del = win(13, 18.5);
  return (
    <CompareFrame
      f={f}
      dur={dur}
      no={7}
      stage={3}
      title="찜 목록 정리"
      request="“그리고 찜한 학교 목록에서는 학교 순서 변경이나 삭제가 되면 좋겠어.”"
      reasons={[['먼저 볼 학교는 위로 올리고, 다 본 학교는 그 자리에서 빼고 싶었습니다.', 3]]}
      left={{
        src: 'screens/list-before.webp',
        size: [1280, 800],
        cam,
        label: '학교 이름만 있는 목록',
      }}
      right={{
        src: 'screens/list-after.webp',
        size: [1280, 800],
        cam,
        label: '순서 변경·삭제 버튼',
        overlay: (k) => (
          <>
            <Ring x={702} y={437} r={34} scale={k} opacity={up} />
            <Ring x={738} y={437} r={34} scale={k} opacity={down} />
            <Ring x={777} y={437} r={38} scale={k} opacity={del} color={C.heart} />
          </>
        ),
      }}
      callout={
        <>
          <Tag x={1430} y={624} text="▲ 위로 올리기" op={up} />
          <Tag x={1430} y={624} text="▼ 아래로 내리기" op={down} />
          <Tag x={1430} y={624} text="삭제: 찜 해제" op={del} />
        </>
      }
    />
  );
};

// ───────── 2단계 ④ 제천 행정동 이름 ─────────

const City = () => {
  const f = useCurrentFrame();
  const dur = SCENES.city[1];
  const cam = camAt(f, [
    {t: 0, cx: 640, cy: 400, w: 1280},
    {t: 4, cx: 640, cy: 400, w: 1280},
    {t: 8, cx: 765, cy: 255, w: 330},
    {t: 15, cx: 765, cy: 255, w: 330},
    {t: 19, cx: 700, cy: 420, w: 700},
  ]);
  return (
    <CompareFrame
      f={f}
      dur={dur}
      no={4}
      stage={2}
      title="제천 행정동 이름"
      request="“충주시와 제천시는 구로 구분해야하나 청주처럼?”"
      reasons={[
        ['제천에서는 읍·면·행정동으로 학교를 찾습니다.', 2],
        ['시 전체에서는 작은 동 이름을 감추고, 시내를 확대할 때 읽을 수 있게 했습니다.', 9],
      ]}
      left={{
        src: 'screens/city-before.webp',
        size: [1280, 800],
        cam,
        label: '동 이름이 없음',
      }}
      right={{
        src: 'screens/city-after.webp',
        size: [1280, 800],
        cam,
        label: '확대하면 읍·면·동 이름',
      }}
      callout={
        <>
          <Tag x={490} y={624} text="어느 동네인지 알기 어려움" op={appear(f, s(8.5))} />
          <Tag x={1430} y={624} text="영서동 · 화산동 · 신백동 …" op={appear(f, s(8.5))} />
        </>
      }
    />
  );
};

// ───────── 1단계 ① 인구밀도 지도 ─────────

const Density = () => {
  const f = useCurrentFrame();
  const dur = SCENES.density[1];
  // 지형 → 시·군(1차), 시·군 → 읍·면·동(2차). 마지막에 청주 시내를 확대한다.
  const step = interpolate(f, [s(11), s(12)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cam = camAt(f, [
    {t: 0, cx: 640, cy: 400, w: 1280},
    {t: 15.5, cx: 640, cy: 400, w: 1280},
    {t: 18.5, cx: 440, cy: 420, w: 480},
    {t: 24, cx: 440, cy: 420, w: 480},
  ]);
  const second = step >= 0.5;
  return (
    <CompareFrame
      f={f}
      dur={dur}
      no={1}
      stage={1}
      title="처음 화면을 인구밀도 지도로"
      request={[
        ['“지금 지도가 지형 지도인데, 인구밀도 지도로 나타내자. 디폴트를 인구밀도 지도로.”', 0],
        ['“눈이 불편하지 않은 색으로 하면 좋겠어. 그리고 조금 더 자세한 인구밀도 지도였으면 좋겠어. 시군 별로만 나누지 말고.”', 11],
      ]}
      reasons={[
        ['앱을 열자마자 어느 지역에 사람이 많이 사는지 보이도록 했습니다.', 2],
        ['시·군 안에서도 시내와 산간 마을의 차이가 보이게 읍·면·동으로 나누고, 눈이 편한 색으로 바꿨습니다.', 12],
      ]}
      left={{
        src: 'screens/density-terrain.webp',
        src2: 'screens/density-county.webp',
        mix: step,
        size: [1280, 800],
        cam,
        label: second ? '시·군 단위, 빨강·주황' : '지형 지도',
      }}
      right={{
        src: 'screens/density-county.webp',
        src2: 'screens/density-dong.webp',
        mix: step,
        size: [1280, 800],
        cam,
        label: second ? '읍·면·동 153곳, 눈이 편한 색' : '시·군 인구밀도 지도',
      }}
      callout={
        <>
          <Tag x={490} y={624} text="청주 전체가 한 가지 색" op={appear(f, s(19))} />
          <Tag x={1430} y={624} text="청주 시내와 바깥 면이 구분됨" op={appear(f, s(19))} />
        </>
      }
    />
  );
};

// ───────── 2단계 ② 지역을 골랐을 때 ─────────

const Select = () => {
  const f = useCurrentFrame();
  const dur = SCENES.select[1];
  // 자리 잡은 화면(첫 요청) → 읍·면 조각이 떠오르는 순간(두 번째 요청)
  const lift = interpolate(f, [s(11), s(12)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cam = camAt(f, [
    {t: 0, cx: 640, cy: 400, w: 1280},
    {t: 2.5, cx: 640, cy: 400, w: 1280},
    {t: 5.5, cx: 615, cy: 410, w: 680},
  ]);
  const lifted = lift >= 0.5;
  return (
    <CompareFrame
      f={f}
      dur={dur}
      no={2}
      stage={2}
      title="지역을 골라도 인구밀도 그대로"
      request={[
        ['“지역 선택이 되어도 인구밀도 지도가 유지되도록 해줘.”', 0],
        ['“색까지 함께 떠오르게”', 11],
      ]}
      reasons={[
        ['지역을 고르면 덮개 때문에 인구밀도 색이 가려졌습니다.', 2],
        ['이제 인구가 많은 곳과 학교 위치를 함께 보고, 읍·면 조각이 색과 함께 떠올라 어떻게 나뉘는지 보입니다.', 9],
      ]}
      left={{
        src: 'screens/select-before.webp',
        src2: 'screens/select-before-lift.webp',
        mix: lift,
        size: [1280, 800],
        cam,
        label: lifted ? '떠오르는 순간: 회색 조각이 색을 가림' : '괴산군을 고르면 덮개로 흐려짐',
      }}
      right={{
        src: 'screens/select-after.webp',
        src2: 'screens/select-after-lift.webp',
        mix: lift,
        size: [1280, 800],
        cam,
        label: lifted ? '떠오르는 순간: 색과 함께 떠오름' : '인구밀도 색 그대로, 테두리로 강조',
      }}
      callout={
        <>
          <Tag x={490} y={624} text={lifted ? '조각만 하얗게 떠오름' : '인구밀도 색이 가려짐'} op={appear(f, s(6))} />
          <Tag x={1430} y={624} text={lifted ? '읍·면 조각이 색과 함께' : '괴산읍이 더 진한 색'} op={appear(f, s(6))} />
        </>
      }
    />
  );
};

// ───────── 2단계 ③ 단양 읍·면 ─────────

const Danyang = () => {
  const f = useCurrentFrame();
  const dur = SCENES.danyang[1];
  const cam = camAt(f, [
    {t: 0, cx: 640, cy: 400, w: 1280},
    {t: 2, cx: 640, cy: 400, w: 1280},
    {t: 5, cx: 640, cy: 425, w: 640},
  ]);
  const pick = interpolate(f, [s(8), s(8.6), s(15), s(15.5)], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <CompareFrame
      f={f}
      dur={dur}
      no={3}
      stage={2}
      title="단양군 읍·면 구분"
      request="“단양군 읍, 면 구분 추가해줘.”"
      reasons={[['다른 군처럼 단양도 읍·면을 눌러 그곳 학교만 볼 수 있게 했습니다.', 2]]}
      left={{
        src: 'screens/danyang-before.webp',
        size: [1280, 800],
        cam,
        label: '단양군 전체로만 보기',
      }}
      right={{
        src: 'screens/danyang-after.webp',
        size: [1280, 800],
        cam,
        label: '8개 읍·면으로 나눠 보기',
        overlay: (k) => <Ring x={469} y={545} r={52} scale={k} opacity={pick} />,
      }}
      callout={
        <>
          <Tag x={490} y={624} text="읍·면을 고를 수 없음" op={appear(f, s(6))} />
          <Tag x={1430} y={624} text="단성면 → 단성중 · 한국호텔관광고" op={pick} />
        </>
      }
    />
  );
};

// ───────── 마무리 ─────────

const Outro = () => {
  const f = useCurrentFrame();
  const dur = SCENES.outro[1];
  const sw = interpolate(f, [s(2.5), s(4)], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const end = appear(f, s(8.5), 20);
  return (
    <AbsoluteFill style={{background: C.bg, opacity: fade(f, dur, 12)}}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          height: 700,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: 1 - end,
        }}
      >
        <div style={{position: 'absolute', opacity: 1 - sw, transform: `scale(${1 - sw * 0.1})`}}>
          <Device label="휴대폰">
            <Img src={staticFile('screens/map-mobile-density.webp')} style={{width: 300, height: 649, display: 'block'}} />
          </Device>
        </div>
        <div style={{position: 'absolute', opacity: sw, transform: `scale(${0.9 + sw * 0.1})`}}>
          <Device label="컴퓨터">
            <Img src={staticFile('screens/map-desktop-density.webp')} style={{width: 1040, height: 650, display: 'block'}} />
          </Device>
        </div>
      </div>
      <div style={{opacity: 1 - end}}>
        <Caption
          lines={[
            ['인구를 보고, 학교가 어디에 있는지 살피고, 관심 있는 학교를 고르는 지도.', s(0.8)],
            ['직접 써 보며 일곱 장면을 고쳤습니다.', s(1.6)],
          ]}
          f={f}
        />
      </div>

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: end,
          flexDirection: 'column',
          gap: 26,
        }}
      >
        <div style={{fontSize: 96, fontWeight: 800, color: C.green}}>충북 지도</div>
        <div style={{fontSize: 34, color: C.ink, fontWeight: 600}}>
          인구 보기 · 학교 분포 보기 · 관심 학교 고르기
        </div>
        <div
          style={{
            marginTop: 20,
            padding: '12px 30px',
            borderRadius: 14,
            background: '#fff',
            fontSize: 32,
            color: C.green,
            fontWeight: 700,
          }}
        >
          youe2019-commits.github.io/chungbuk-map/dist/
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────── 전체 ─────────

export const ChungbukIntro = () => (
  <AbsoluteFill style={{background: C.bg, fontFamily: FONT, wordBreak: 'keep-all'}}>
    <Sequence from={SCENES.intro[0]} durationInFrames={SCENES.intro[1]}>
      <Intro />
    </Sequence>
    <Sequence from={SCENES.density[0]} durationInFrames={SCENES.density[1]}>
      <Density />
    </Sequence>
    <Sequence from={SCENES.select[0]} durationInFrames={SCENES.select[1]}>
      <Select />
    </Sequence>
    <Sequence from={SCENES.danyang[0]} durationInFrames={SCENES.danyang[1]}>
      <Danyang />
    </Sequence>
    <Sequence from={SCENES.city[0]} durationInFrames={SCENES.city[1]}>
      <City />
    </Sequence>
    <Sequence from={SCENES.heart[0]} durationInFrames={SCENES.heart[1]}>
      <Heart />
    </Sequence>
    <Sequence from={SCENES.cards[0]} durationInFrames={SCENES.cards[1]}>
      <Cards />
    </Sequence>
    <Sequence from={SCENES.list[0]} durationInFrames={SCENES.list[1]}>
      <List />
    </Sequence>
    <Sequence from={SCENES.outro[0]} durationInFrames={SCENES.outro[1]}>
      <Outro />
    </Sequence>
  </AbsoluteFill>
);
