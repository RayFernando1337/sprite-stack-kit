# Pixel Fighter: a full specification

| | |
| --- | --- |
| Author | 阿旭gogogo ([@axu_ai](https://x.com/axu_ai)) |
| Posted | 18 November 2026, as [a reply to his own post](https://x.com/axu_ai/status/2122971569417068655) |
| Language | Chinese. An English translation follows |
| Author's result | In [his post](https://x.com/axu_ai/status/2122971403368739242) he reports one prompt with GPT-6.2 Astra Ultra, 20 minutes, then one or two rounds of small fixes, giving a single 119 KB HTML file. He adds that the result is still some way from the original |
| Output | One `index.html` with a Chinese interface |

This prompt is axu's work and is reproduced here with credit. It will be removed if he asks.

## Why it is worth reading

It is the most complete written description of the game anyone has shared. It covers the renderer, the world, the jet, the three views, flight, combat, ejection, the interface, sound and input, in twelve sections.

Three things in it are worth borrowing for any prompt of this kind:

- **Section 2 comes first for a reason.** It fixes the rendering approach before anything else, and says so: "this is the root of the look".
- **Section 12 ranks the features.** It tells the model what to protect if it runs out of room. Without this, a model tends to do everything thinly.
- **It is exact.** Sizes, speeds, times and colours are given as numbers.

Many of its numbers match constants in Dash's published build: the 2048 × 2048 world, the cloud layer, the terrain colours, the 13 slices of 34 × 46, the flight defaults and most of the weapon timings. A few details differ. For example, the prompt gives 0.5 seconds for a missile lock where the build uses 0.8, and it describes the jet's size in the chase view as a share of the frame's height where the build's setting is its width. Treat the prompt as axu's specification, not as a transcript of the game.

To get an English game from it, translate the quoted interface text in section 9 and change the rule that all visible text must be Chinese.

## The original

```text
你是一名资深图形程序员兼游戏设计师。请在**这一次回复中**交付一个可直接运行的中文版像素战机游戏《像素战机》。不要提问，不要给方案，不要写占位或 TODO，直接输出完整代码。

## 一、交付形式

- 只输出一个 `index.html`，内联全部 CSS 和 JavaScript，不依赖任何外部库、字体、图片、音频文件，双击即可在桌面版 Chrome 运行。
- 所有画面资源（地形、云、战机、敌机、座舱）都用代码程序化生成；所有声音用 Web Audio 实时合成。
- 代码先完整输出，最后用不超过 8 行说明操作方式和你做的取舍。

## 二、渲染架构（这是画风的根本，必须照做）

- 写一个**软件渲染器**。游戏铺满浏览器窗口，顶栏和底部操作提示之间的区域全部用来飞行。以 320×240 为像素密度参考，根据飞行区域的实际尺寸选取整数放大倍率，再分别用区域宽、高除以倍率并向上取整，得到低分辨率缓冲的宽和高。用 `ImageData` 加 `Uint32Array` 逐像素写入，以同一整数倍率放大两轴，CSS 设 `image-rendering: pixelated`。宽屏两侧显示更多世界，横竖屏都铺满，飞机保持原有比例。
- 文字界面不要画进低分辨率缓冲，用 DOM 叠在画布上，保证中文清晰。
- 第二层透明画布按屏幕分辨率叠在上面，只画锁定框、来袭导弹的双环等瞄准符号。
- 使用带种子的伪随机数（种子 7），每次打开世界一致。循环里不要逐帧分配对象，粒子全部用定长 `Float32Array` 池。

## 三、世界

- 一张 2048×2048、四边循环拼接的高度图，由多层噪声生成群岛：陆地约占三分之一，最高 40 层。
- 每个地面像素有“高度”和“材质”。材质的顶面色 / 侧面色（RGB）：
  - 深海 36,104,180；中海 44,124,198；浅海 66,160,216；浪花 104,204,214
  - 沙滩 238,220,164（侧面 204,180,122）
  - 草地 96,178,52；暗草 70,148,44；亮草 134,206,76（侧面约 56,120,44）
  - 树冠 70,158,64；树 42,122,54；树缘 28,92,46（侧面约 22,72,40）
  - 岩石 146,140,134；暗岩 118,112,110；亮岩 178,172,162（侧面约 96,90,92）
  - 雪 246,250,255；雪影 214,226,244
- 草地按等高线分出阶梯状梯田，海岸有一圈浅水和浪花，海面随机散布白色短竖线高光。
- 云是另一张 1024×1024 循环图，厚 8 层，悬在 40 的高度，覆盖率约 45%，纯白蓬松，边缘用棋盘格抖动变软。云在海面和陆地上投下偏移的深色影子。战机穿过云会切出一条通道，约 11 秒后愈合。
- 战机在地面上也有影子。

## 四、战机（切片堆叠）

- 战机是一个体素模型：13 层水平切片，每层 34×46 像素，第 0 层是机腹，第 12 层是垂尾尖。请用代码定义这个模型：后掠三角翼、双发动机、双垂尾、座舱盖。机身深灰 `#545969`，机翼后缘和翼尖橙红 `#f0580e`，座舱盖青色 `#1e8ca0`。
- 绘制方法：按偏航角旋转每一层，从下到上每层错开 1 像素叠画，整体加 1 像素深色描边。转弯时自动压坡度，最大 52 度；横滚、俯仰都要让切片堆叠正确变形。每个体素多次采样，旋转后不能出现针孔。
- 开场动画：切片从屏幕上方一片片落下叠成战机。
- 两个翼尖各拖一条白色细尾迹（每条保留 160 个点，逐渐变淡）。发动机喷出橙红到亮黄的像素尾焰，加力时变长变亮。

## 五、三种视角，共用一台摄像机

- 俯视、追尾、座舱三种视角，空格键依次切换。切换是 1.4 秒的**连续镜头运动**，不是硬切。
- 追尾视角：摄像机在战机后上方约 12 度，战机约占画面高度 19%。地形用“高度图逐列由近到远”的方法画成伪 3D，视距 1500，300 以外开始分 10 级雾化，天空 8 条色带并用 4×4 拜耳矩阵抖动过渡，地平线附近有太阳。爬升时地平线下沉。
- 座舱视角：世界随战机一起横滚。下半屏是像素座舱：左屏绿色雷达（扫描线旋转、同心环）、中央姿态球（上蓝下棕、橙色机翼标）、右屏绿色战机状态图加速度和高度数字、两侧旋钮拨杆和橙色警示灯；上方有弧形座舱框。挡风玻璃上叠绿色平显：俯仰梯、准星框、左侧速度、右侧高度、底部航向，顶部罗盘带标出方位字。
- 座舱框随窗口延伸到屏幕两边，雷达与姿态球在宽屏和竖屏下都保持圆形。准星指向机头正前方，速度、高度与罗盘文字跟随对应仪表。

## 六、飞行手感

- 巡航速度 92 像素/秒，加力 1.8 倍；默认高度 64，升限 300，离地最小间隙 7。
- 指针引导：俯视时战机转向指针所在方向；追尾和座舱视角下，指针在战机左右控制转向，指针在战机**下方爬升、上方俯冲**。
- 键盘：A D 或 ← → 转向，S 爬升，W 俯冲，Shift 加力。
- 鼠标左键：短按（少于 0.2 秒）是横滚一圈，长按是加力。
- 最大爬升角 1.4 弧度，最大俯冲角 0.62 弧度。
- 特技：加力并拉满爬升按住不放，做后空翻；加力并压满俯冲，做前空翻（高度不够时提示）。F 键自动向后筋斗，G 键自动向前筋斗，一圈 3.6 秒。
- 贴海低飞（高度低于 24）时在水面拖出白色尾浪，持续 2.8 秒。

## 七、战斗

- 场上常驻 3 架敌机（最多 5 架），红黑配色，在玩家附近游弋、绕到身后攻击。敌机上方有红色小箭头标记。
- 机炮：按住鼠标右键，每秒 18 发，两门炮交替射击。弹速 620，飞行 0.95 秒。默认弹流在机头前方 520 处交汇。玩家曳光弹为黄色，敌方为红色，开火时抛出下落的黄铜弹壳。
- 机炮对新手友好：敌机进入前方 500 范围时，只要机头大致对准，双炮就辅助瞄准并预判目标移动，最多提前 0.65 秒。让高度方向的容错大于水平方向，使俯视玩家可以击中有高度差的敌机。多目标时优先靠近瞄准中心的敌机，并尽量保持当前目标。辅助只修正子弹出膛方向，飞行中的炮弹沿直线前进，命中敌机的判定半径为 15。
- 敌机 5 发击落，玩家机体 6 格。敌机在 430 距离内开火。
- 锁定：选择距离 950 以内、与机头夹角不超过 26° 的最近敌机。持续跟踪 0.5 秒后方框由黄变红，可以发射导弹。跟踪中的敌机允许偏离机头最多 34°，轻微转向或另一架敌机经过时仍能保持目标。
- 导弹：M 键发射。先脱离挂架下坠 0.34 秒，再点火，0.5 秒达到全推力，燃烧 1.9 秒，转向能力 3.4 弧度/秒，按目标预判位置追踪。
- 弹药：机炮 300 发，导弹 6 枚，打空后 5 秒自动装填，装填时显示进度。
- 敌机会发射导弹：屏幕出现两个逐渐重合的圆环，外环上的楔形指示来袭方向。**在两环重合的瞬间横滚**即可甩掉，同时进入约 1.3 秒慢动作，画面中央闪出“规避成功”。
- 反击：规避成功后立刻按 M，连发三枚导弹（间隔 0.12 秒），不消耗弹药，中央闪出“反击”。
- 敌机被击落后机头朝下翻滚、拖黑烟坠落，落海有水花和蒸汽，落地爆炸。爆炸颜色由亮到暗：255,250,224 → 255,214,96 → 250,140,40 → 206,66,24 → 52,46,50。随后有新敌机补位。
- 镜头反馈：中弹和爆炸时屏幕震动、短暂闪白；画面带轻微暗角。

## 八、坠毁与弹射（原作的标志性设计）

- 关闭加力俯冲撞地，或机体归零：战机爆炸，飞行员被弹射座椅火箭推上天，开伞缓慢飘落，一架新战机飞来接住他，伞绳割断、人落进座舱、座舱盖合上，整个过程约 2.8 秒，之后继续游戏。没有“游戏结束”画面。
- 镜头先跟飞行员，在落座前 1.3 秒滑回新战机。

## 九、界面与中文文案

所有界面元素统一样式：背景 `#0b1a33` 55% 不透明，圆角 3px，等宽字体 11px，字距加宽，白色 90%，1px 深色文字阴影。字体栈用 `"PingFang SC","Microsoft YaHei",monospace`。

- 左上：`击落 00` 和 `机体` 加 6 个小竖条（剩余为白，损失为 22% 白）
- 左下：`弹药 300` 和 `导弹` 加 6 个小竖条
- 右上两个按钮：`情报`、`教程`
- 底部提示，随视角变化：
  - 俯视：`移动指针转向 · 单击横滚 · 按住开加力 · 空格切换追尾视角`
  - 追尾：`指针控制转向与俯仰 · 单击横滚 · 按住开加力 · 空格进入座舱`
  - 座舱：`指针控制转向与俯仰 · 单击横滚 · 按住开加力 · 空格回到俯视`
- `情报`面板（I 键开关，打开时游戏暂停）分三栏：
  - 飞行：转向 / 爬升与俯冲 / 加力 / 切换视角
  - 特技：横滚 / 后空翻 / 前空翻 / 自动筋斗 / 弹射
  - 战斗：机炮 / 锁定 / 导弹 / 规避导弹 / 反击 / 弹药
  - 底部一行：`按 I 开关本面板，按 T 开始教程`
- `教程`（T 键）：逐步教学，每步显示标题、一句做法、进度条和 `跳过此步`，可随时 `结束教程`。顺序：转向、爬升、俯冲、加力、切换视角、横滚、后空翻、前空翻、机炮、锁定（飞来一架靶机）、导弹、规避导弹（训练中不会受伤）、反击、弹射。完成时显示：`教程完成。全部内容就是这些，忘了可以看情报。祝狩猎顺利。`
- 情境提示：`太低了，先爬升一点`、`弹药打空，正在装填`、`导弹打空，正在装填`、`先锁定：把它保持在正前方直到方框变红`、`导弹来袭，两环重合时横滚`、`被击中了，下一枚马上来`、`有敌机绕到你身后`、`就是现在，开火！`、`很好，新战机正在赶来`。
- 界面上不出现任何英文。

## 十、声音（全部合成，首次点击或按键后才启动）

- 四条持续音轨按状态实时混合：发动机、加力轰鸣、风声（穿云时更大）、俯冲过低告警。
- 一次性音效：机炮（玩家自己的最响，其余让位）、锁定提示音（逐渐加快，锁定后变成稳定高音）、来袭导弹告警（越近越急，可规避的瞬间一声尖音）、爆炸、弹射、开伞、座舱盖合上、低空掠海水声。
- 慢动作期间所有声音压低，结束后恢复。总音量 0.6。

## 十一、其他输入

- 触屏设备自动显示按钮：`加力`、`机炮`、`导弹`、`视角`、`筋斗`；拖动转向和俯仰，轻点横滚。
- 支持手柄：左摇杆飞行，右扳机加力，按键对应横滚、机炮、导弹、视角、筋斗。

## 十二、质量底线与取舍顺序

- 以稳定 60 帧为目标。窗口缩放或横竖屏切换后，重新计算缓冲尺寸、镜头中心和指针坐标，让飞机、准星与锁定框对齐。失焦时暂停。
- 如果篇幅不够，按这个顺序保证完成度，宁可后面的简化，也不要前面的粗糙：
  1. 软件渲染、群岛和云、切片堆叠战机、俯视飞行手感、尾迹尾焰
  2. 追尾视角和连续镜头切换
  3. 机炮、敌机、锁定、导弹、中文界面
  4. 规避与反击、弹射换机
  5. 座舱视角、教程、声音、触屏和手柄
- 输出前自查：没有未定义变量；没有外部请求；三种视角都能进入并返回；所有可见文字都是中文。
```

## English translation

Translated for this kit. If the translation and the original disagree, the original is right. Text that the prompt asks to appear on screen is left in Chinese, with its meaning in brackets.

```text
You are a senior graphics programmer and game designer. In **this one reply**, deliver a ready-to-run Chinese-language pixel fighter game called 《像素战机》 (Pixel Fighter). Do not ask questions, do not give a plan, do not write placeholders or TODOs. Output the complete code directly.

## 1. Deliverable

- Output a single `index.html` with all CSS and JavaScript inline and no dependence on any external library, font, image or audio file. A double-click runs it in desktop Chrome.
- All visual assets (terrain, clouds, fighter, enemy aircraft, cockpit) are generated procedurally in code. All sound is synthesised in real time with Web Audio.
- Output the complete code first. Then explain the controls and the trade-offs you made in no more than 8 lines.

## 2. Rendering architecture (this is the root of the look; follow it exactly)

- Write a **software renderer**. The game fills the browser window, and the whole area between the top bar and the control hints at the bottom is used for flying. Using 320×240 as the reference pixel density, choose a whole-number scale factor from the actual size of the flight area, then divide the area's width and height by that factor and round up to get the width and height of the low-resolution buffer. Write pixel by pixel with `ImageData` and a `Uint32Array`, scale both axes by the same whole number, and set `image-rendering: pixelated` in CSS. A wide screen shows more of the world at the sides. Landscape and portrait are both filled. The aircraft keeps its proportions.
- Do not draw the text interface into the low-resolution buffer. Overlay it on the canvas with DOM elements so the Chinese text stays sharp.
- A second, transparent canvas at screen resolution sits on top and draws only aiming symbols, such as the lock box and the double ring of an incoming missile.
- Use seeded pseudo-random numbers (seed 7) so the world is the same every time it is opened. Do not allocate objects every frame in the loop. All particles use fixed-length `Float32Array` pools.

## 3. The world

- One 2048×2048 heightmap that wraps on all four edges, with an archipelago generated from several layers of noise. Land covers about one third, and the highest point is 40 layers.
- Every ground pixel has a "height" and a "material". Top colour / side colour (RGB) of the materials:
  - Deep sea 36,104,180; mid sea 44,124,198; shallow sea 66,160,216; surf 104,204,214
  - Sand 238,220,164 (side 204,180,122)
  - Grass 96,178,52; dark grass 70,148,44; light grass 134,206,76 (side about 56,120,44)
  - Tree crown 70,158,64; tree 42,122,54; tree edge 28,92,46 (side about 22,72,40)
  - Rock 146,140,134; dark rock 118,112,110; light rock 178,172,162 (side about 96,90,92)
  - Snow 246,250,255; snow shadow 214,226,244
- Grass is split along contour lines into stepped terraces. The coast has a ring of shallow water and surf. White highlights in short vertical strokes are scattered at random over the sea.
- The clouds are a second, wrapping 1024×1024 map, 8 layers thick, hanging at a height of 40, with about 45% coverage. They are pure white and fluffy, with edges softened by checkerboard dithering. The clouds cast offset dark shadows on the sea and the land. A fighter flying through a cloud cuts a channel that heals after about 11 seconds.
- The fighter also casts a shadow on the ground.

## 4. The fighter (sprite stacking)

- The fighter is a voxel model: 13 horizontal slices of 34×46 pixels each. Slice 0 is the belly and slice 12 is the tips of the vertical tails. Define this model in code: swept delta wing, twin engines, twin vertical tails, canopy. Fuselage dark grey `#545969`; wing trailing edges and wingtips orange-red `#f0580e`; canopy cyan `#1e8ca0`.
- How to draw it: rotate every slice by the yaw angle and draw them from bottom to top, each offset by 1 pixel, with a 1-pixel dark outline round the whole. It banks automatically in turns, up to 52 degrees. Roll and pitch must both deform the stack correctly. Sample each voxel several times so that no pinholes appear after rotation.
- Opening animation: the slices fall from the top of the screen one by one and stack up into the fighter.
- Each wingtip trails a thin white trail (each keeps 160 points and fades gradually). The engines emit pixel flames from orange-red to bright yellow, which grow longer and brighter under afterburner.

## 5. Three views sharing one camera

- Three views (overhead, chase, cockpit), cycled in order with the space bar. A switch is a 1.4-second **continuous camera move**, not a hard cut.
- Chase view: the camera is behind and above the fighter at about 12 degrees, and the fighter takes up about 19% of the frame's height. The terrain is drawn as pseudo-3D with the "heightmap, column by column, near to far" method. View distance 1500. Fog starts beyond 300, in 10 steps. The sky has 8 colour bands with 4×4 Bayer-matrix dithering between them, and there is a sun near the horizon. The horizon sinks when climbing.
- Cockpit view: the world rolls with the fighter. The lower half of the screen is a pixel cockpit: a green radar on the left screen (rotating sweep line, concentric rings); an attitude ball in the centre (blue above, brown below, an orange wing marker); on the right screen a green status diagram of the fighter plus speed and altitude figures; knobs, toggle switches and orange warning lamps on both sides; an arched canopy frame above. A green head-up display is overlaid on the windscreen: pitch ladder, reticle box, speed on the left, altitude on the right, heading at the bottom, and a compass strip at the top marked with direction letters.
- The canopy frame extends with the window to both edges of the screen. The radar and the attitude ball stay round on wide and portrait screens. The reticle points straight ahead of the nose. The speed, altitude and compass text follow their instruments.

## 6. Flight feel

- Cruise speed 92 pixels/second; afterburner ×1.8; default altitude 64, ceiling 300, minimum ground clearance 7.
- Pointer guidance: in the overhead view the fighter turns toward where the pointer is. In the chase and cockpit views, the pointer to the left or right of the fighter controls the turn, and the pointer **below the fighter climbs, above it dives**.
- Keyboard: A D or ← → turn, S climbs, W dives, Shift for afterburner.
- Left mouse button: a short press (under 0.2 seconds) is one full roll; a long press is afterburner.
- Maximum climb angle 1.4 radians; maximum dive angle 0.62 radians.
- Stunts: holding afterburner with full climb performs a back flip; afterburner with full dive performs a front flip (with a warning when there is not enough altitude). The F key does an automatic backward loop and the G key an automatic forward loop. One loop takes 3.6 seconds.
- Flying low over the sea (altitude under 24) drags a white wake across the water that lasts 2.8 seconds.

## 7. Combat

- There are always 3 enemy aircraft in play (5 at most), in red and black, roaming near the player and circling behind to attack. A small red arrow marks each enemy from above.
- Cannon: hold the right mouse button; 18 rounds per second, the two guns firing in turn. Round speed 620, flight time 0.95 seconds. By default the two streams converge 520 ahead of the nose. The player's tracers are yellow and the enemy's are red. Firing throws out brass casings that fall away.
- The cannon is friendly to beginners: when an enemy comes within 500 ahead, as long as the nose is roughly on it, both guns assist the aim and lead the target's movement by up to 0.65 seconds. Make the tolerance in height larger than the tolerance sideways, so a player in the overhead view can hit enemies at a different altitude. With several targets, prefer the enemy nearest the centre of aim and keep the current target where possible. The assist only corrects the direction a round leaves the barrel. Rounds in flight travel in a straight line. The hit radius against an enemy is 15.
- An enemy is shot down by 5 rounds. The player's hull has 6 points. Enemies open fire within a distance of 430.
- Lock-on: select the nearest enemy within a distance of 950 and no more than 26° off the nose. After 0.5 seconds of continuous tracking the box turns from yellow to red, and a missile can be fired. An enemy being tracked may stray up to 34° off the nose, so the target is kept through a slight turn or when another enemy passes.
- Missiles: fired with the M key. A missile first drops off its rail for 0.34 seconds, then ignites, reaches full thrust in 0.5 seconds, burns for 1.9 seconds, can turn at 3.4 radians/second, and homes on the target's predicted position.
- Ammunition: 300 cannon rounds and 6 missiles. An automatic reload takes 5 seconds once empty, with progress shown while reloading.
- Enemies fire missiles: two rings appear on screen and gradually converge, and a wedge on the outer ring shows the direction of the threat. **Rolling at the moment the two rings meet** shakes the missile off and starts about 1.3 seconds of slow motion, with "规避成功" (Evaded) flashing in the centre of the screen.
- Counter-attack: pressing M immediately after a successful evasion fires three missiles in a row (0.12 seconds apart) at no cost in ammunition, with "反击" (Counter) flashing in the centre.
- A shot-down enemy tumbles nose-down and falls trailing black smoke. Hitting the sea makes spray and steam, and hitting land makes an explosion. Explosion colours from bright to dark: 255,250,224 → 255,214,96 → 250,140,40 → 206,66,24 → 52,46,50. A new enemy then takes its place.
- Camera feedback: the screen shakes and briefly flashes white on hits and explosions. The picture has a slight vignette.

## 8. Crashing and ejecting (the original's signature design)

- Diving into the ground with the afterburner off, or the hull reaching zero: the fighter explodes, the pilot is shot skyward by the ejection seat's rocket, the parachute opens and he drifts down slowly, a new fighter flies in and catches him, the parachute lines are cut, he drops into the cockpit and the canopy closes. The whole sequence takes about 2.8 seconds, and then play continues. There is no "game over" screen.
- The camera first follows the pilot, and slides back to the new fighter 1.3 seconds before he is seated.

## 9. Interface and Chinese copy

All interface elements share one style: background `#0b1a33` at 55% opacity, 3px rounded corners, 11px monospace type with widened letter spacing, 90% white, a 1px dark text shadow. The font stack is `"PingFang SC","Microsoft YaHei",monospace`.

- Top left: `击落 00` (Kills 00), and `机体` (Hull) with 6 small vertical bars (remaining ones white, lost ones 22% white)
- Bottom left: `弹药 300` (Ammo 300), and `导弹` (Missiles) with 6 small vertical bars
- Two buttons at top right: `情报` (Intel) and `教程` (Tutorial)
- Hints at the bottom, changing with the view:
  - Overhead: `移动指针转向 · 单击横滚 · 按住开加力 · 空格切换追尾视角` (Move the pointer to steer · click to roll · hold for afterburner · space for the chase view)
  - Chase: `指针控制转向与俯仰 · 单击横滚 · 按住开加力 · 空格进入座舱` (The pointer controls turn and pitch · click to roll · hold for afterburner · space to enter the cockpit)
  - Cockpit: `指针控制转向与俯仰 · 单击横滚 · 按住开加力 · 空格回到俯视` (The pointer controls turn and pitch · click to roll · hold for afterburner · space to return to overhead)
- The `情报` (Intel) panel (toggled with the I key; the game pauses while it is open) has three columns:
  - Flying: turning / climbing and diving / afterburner / switching views
  - Stunts: roll / back flip / front flip / automatic loops / ejecting
  - Combat: cannon / lock-on / missiles / evading missiles / counter-attack / ammunition
  - A line at the bottom: `按 I 开关本面板，按 T 开始教程` (Press I to open or close this panel, press T to start the tutorial)
- `教程` (Tutorial, the T key): step-by-step teaching. Each step shows a title, one sentence on what to do, a progress bar and `跳过此步` (Skip this step), and `结束教程` (End tutorial) is available at any time. Order: turning, climbing, diving, afterburner, switching views, roll, back flip, front flip, cannon, lock-on (a target drone flies in), missiles, evading missiles (no damage is taken in training), counter-attack, ejecting. On completion show: `教程完成。全部内容就是这些，忘了可以看情报。祝狩猎顺利。` (Tutorial complete. That is everything. If you forget, look at Intel. Good hunting.)
- Situational hints: `太低了，先爬升一点` (Too low, climb a little first), `弹药打空，正在装填` (Out of ammo, reloading), `导弹打空，正在装填` (Out of missiles, reloading), `先锁定：把它保持在正前方直到方框变红` (Lock on first: keep it dead ahead until the box turns red), `导弹来袭，两环重合时横滚` (Missile incoming, roll when the two rings meet), `被击中了，下一枚马上来` (You were hit, the next one is coming right away), `有敌机绕到你身后` (An enemy has circled behind you), `就是现在，开火！` (Now, fire!), `很好，新战机正在赶来` (Good, a new fighter is on its way).
- No English appears anywhere in the interface.

## 10. Sound (all synthesised; starts only after the first click or key press)

- Four continuous tracks mixed in real time according to state: engine, afterburner roar, wind (louder when passing through cloud), and a warning for diving too low.
- One-shot effects: cannon (the player's own is loudest and the others give way to it), a lock tone (speeding up gradually, becoming a steady high tone once locked), an incoming-missile warning (more urgent the closer it gets, with a sharp tone at the moment it can be evaded), explosion, ejection, parachute opening, canopy closing, and the sound of water when skimming low over the sea.
- During slow motion all sound is lowered, and it recovers afterwards. Master volume 0.6.

## 11. Other input

- Touch devices automatically show buttons: `加力` (Afterburner), `机炮` (Cannon), `导弹` (Missile), `视角` (View), `筋斗` (Loop). Drag to turn and pitch; tap to roll.
- Gamepad support: the left stick flies, the right trigger is afterburner, and buttons map to roll, cannon, missile, view and loop.

## 12. Quality floor and order of trade-offs

- Aim for a steady 60 frames per second. After the window is resized or the orientation changes, recompute the buffer size, the camera centre and the pointer coordinates so that the aircraft, the reticle and the lock box line up. Pause when the window loses focus.
- If there is not enough room, protect completeness in this order. Simplify the later items before letting the earlier ones be rough:
  1. Software rendering, the archipelago and clouds, the sprite-stacked fighter, overhead flight feel, trails and flames
  2. The chase view and the continuous camera move
  3. Cannon, enemies, lock-on, missiles, the Chinese interface
  4. Evasion and counter-attack, ejecting and changing aircraft
  5. The cockpit view, the tutorial, sound, touch and gamepad
- Check before output: no undefined variables; no external requests; all three views can be entered and left; all visible text is Chinese.
```
