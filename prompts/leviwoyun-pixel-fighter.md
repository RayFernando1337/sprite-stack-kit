# Pixel Fighter in one conversation

| | |
| --- | --- |
| Author | Levi 卧云 ([@Leviwoyun](https://x.com/Leviwoyun)) |
| Posted | 18 November 2026, as [a reply to his own post](https://x.com/Leviwoyun/status/2122879638603272234) |
| Language | Chinese. An English translation follows |
| Author's result | In [his post](https://x.com/Leviwoyun/status/2122879482327703861) he reports one conversation with GPT 6.2 Astra max, a 38 KB file, and 42 minutes |
| Output | One HTML file |

This prompt is Levi's work and is reproduced here with credit. It will be removed if he asks.

It is short and sets hard limits: one file, no bitmaps of any kind, and a 40 KB budget. It asks for about 30 slices built in code, where Dash's jet has 13 slices cut from drawings. It also names the ground technique plainly: "Comanche-style voxel terrain".

In the same post Levi notes that you can also hand the game's Forge link straight to Codex.

## The original

```text
提示词：请创建单文件HTML可玩作品「像素战机」：一架复古像素风喷气战斗机在海洋和小岛上空飞行，不使用任何3D引擎、WebGL多边形网格或外部库，只用Canvas 2D和手写JavaScript实现伪3D。硬性要求：
飞机用「切片堆叠」（sprite stacking）技术：代码程序化生成约30层像素切片并逐层错位叠加，旋转和滚转时有真实立体感；机身深灰、橙色点缀、青色座舱盖。
地形用高度图逐列渲染（Comanche式体素地形）：程序化生成海岛，有沙滩、悬崖、草地；海面有闪烁的单像素波光；云层有体积感，并在海面和岛上投下移动阴影；飞机在地面投出随地形起伏的影子。
三种视角，按空格切换，切换时镜头平滑过渡1.4秒而不是硬切：①俯视（鼠标转向，飞机跟随指针）；②追尾第三人称，有透视地平线和滚转；③驾驶舱，像素风仪表盘带动态姿态仪、雷达扫描和绿色HUD准星。
操控：鼠标转向，点击滚转，长按加速（喷口出现橙色像素尾焰），翼尖拖出白色尾迹，低空掠海时有水花。
画面底部用黄色像素字体显示当前视角的操作提示。整体为低分辨率大像素（约3像素一点）、高饱和16位色板，加轻微暗角和胶片颗粒。
全屏自适应，60fps流畅；随机数用固定种子。所有代码内联，离线可运行，不依赖外部图片、字体或库，严禁嵌入或加载任何位图，所有画面元素由你的代码程序化绘制。总代码尽量控制在40KB以内。直接完成文件，不要只给方案。文件名用"当前模型名字-当前会话推理等级-像素战机.html"。
```

## English translation

Translated for this kit. If the translation and the original disagree, the original is right.

```text
Prompt: Create a playable single-file HTML piece called "Pixel Fighter": a retro pixel-art jet fighter flying over ocean and small islands. Do not use any 3D engine, WebGL polygon meshes or external libraries. Use only Canvas 2D and hand-written JavaScript to achieve pseudo-3D. Hard requirements:

The aircraft uses "sprite stacking": generate about 30 pixel slices procedurally in code and stack them layer by layer with an offset, so it has real volume when it turns and rolls. Dark grey fuselage, orange accents, cyan canopy.

The terrain is rendered column by column from a heightmap (Comanche-style voxel terrain): procedurally generate islands with beaches, cliffs and grass. The sea has twinkling single-pixel glints. The cloud layer has volume and casts moving shadows on the sea and the islands. The aircraft casts a shadow on the ground that follows the terrain.

Three views, switched with the space bar. The camera moves smoothly over 1.4 seconds when switching and does not cut: (1) overhead (the mouse steers; the aircraft follows the pointer); (2) third-person chase, with a perspective horizon and roll; (3) cockpit, with a pixel-art instrument panel that has a live attitude indicator, a radar sweep and a green HUD reticle.

Controls: the mouse steers, a click rolls, a long press accelerates (orange pixel flames appear at the nozzles), the wingtips leave white trails, and there is spray when skimming low over the sea.

At the bottom of the screen, show the controls for the current view in a yellow pixel font. The overall look is low resolution with big pixels (about 3 screen pixels per dot) and a highly saturated 16-bit palette, with a slight vignette and film grain.

Full-screen and responsive, smooth at 60 fps. Random numbers use a fixed seed. All code is inline and runs offline, with no dependence on external images, fonts or libraries. Embedding or loading any bitmap is strictly forbidden: every visual element is drawn procedurally by your code. Keep the total code within 40 KB as far as possible. Finish the file directly; do not just give a plan. Name the file "<current model name>-<current session reasoning level>-像素战机.html".
```
