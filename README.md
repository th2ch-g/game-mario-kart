# KARTLINE

A complete 3D kart racer for the browser, built with Three.js, React and TypeScript. Race on a phone, a computer, a shared screen or with friends over WebRTC. All courses, kart models, interface illustrations and synthesized sounds are original and generated locally. No game assets need to be downloaded from a third party.

## Play

- **Quick race:** eight karts, three courses, six karts with different handling, three CPU difficulties, and one, three or five laps.
- **Grand Prix:** race all three courses and compete for a cumulative championship. Points per race are 15, 12, 10, 8, 6, 4, 2 and 1.
- **Time attack:** three laps with no opponents, held items or coins. Track ramps and boost pads remain active. Personal bests and a replay ghost are stored in the current browser.
- **Split screen:** two independent karts and cameras on the same computer, with separate keyboard controls and six CPU opponents.
- **Friends:** two to eight people, room code, invitation link, QR code, ready checks, host settings, CPU fill, host pause, guest reconnection and rematch.

Sunshine Coast combines harbor S-bends, a lighthouse hairpin and a boardwalk jump. Maple Highland climbs through switchbacks, a suspension bridge, a rock tunnel and a downhill jump. Starlight City is a grade-separated figure eight with a neon tunnel, an elevated expressway and a downtown chicane. Banked corners, changing road widths, lane-specific boost pads, optional ramps and solid obstacles create different racing lines. The chase camera follows the road ahead; race HUDs include ranking, lap count, timer, speed, inventory, drift charge and a live minimap.

## Driving

Auto acceleration and steering assistance are enabled by default. Both can be changed in settings. Assistance follows bends when the steering control is released and helps keep the kart near the road. Manual steering overrides it. Offroad terrain slows the kart, and barriers prevent leaving the playable area.

Press drift while steering to hop into a drift. The initial turn direction stays locked; countersteering opens the corner without reversing the drift. Blue, orange and purple sparks mark three mini-turbo levels, released by letting go of drift. Grounded tire grip and the shorter inside line affect progress.

Ramps launch the kart along a ballistic arc. Press drift just before takeoff or during flight to perform a spinning trick and earn a landing boost. Holding the button throughout the approach does not repeatedly award tricks. The same controls work with a keyboard, touch and a gamepad.

Item boxes use position-weighted roulette: leaders receive more defensive items and trailing racers receive stronger comeback tools. There are eleven items: mushroom, triple mushroom, red homing shell, green bouncing shell, banana, shield, horn, star, lightning, blue leader-seeking shell and automatic rocket. Hold a shell or banana to guard, then release to throw; hold brake when releasing a shell to throw it backwards. Triple mushrooms require three distinct presses. The horn clears nearby shells, including blue shells. Stars and rockets prevent damage; lightning temporarily shrinks and slows unprotected opponents.

Coins increase maximum speed up to ten coins. A shield blocks one hit. A hit causes a spin and drops three coins. Finished drivers continue under CPU control until the results screen.

| Action             | Solo / online         | Split player 1  | Split player 2 |
| ------------------ | --------------------- | --------------- | -------------- |
| Steer              | Left / Right or A / D | A / D           | Left / Right   |
| Accelerate / brake | Up / Down or W / S    | W / S           | Up / Down      |
| Drift / jump trick | Left Shift or Q       | Left Shift or Q | Right Shift    |
| Use item           | Space or E            | Space or E      | Enter or Slash |
| Pause              | Escape or P           | Escape or P     | Escape or P    |

Touch controls use pointer capture and accept simultaneous steering, drifting and item input. They reset on cancellation, loss of focus and pause. Portrait and landscape layouts account for screen safe areas. Split screen is intended for a shared keyboard. Standard gamepads use the left stick for steering, A for drift, B for items, RT for acceleration and LT for braking.

## Run and verify

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

```sh
npm run check
npm run format:check
npx playwright install chromium webkit
npm run test:e2e
PLAYWRIGHT_BROWSER=webkit npm run test:e2e -- tests/game.spec.ts
```

To use an existing Chrome installation or a workspace-local browser cache:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
PLAYWRIGHT_BROWSERS_PATH=.cache/playwright npx playwright install webkit
PLAYWRIGHT_BROWSERS_PATH=.cache/playwright PLAYWRIGHT_BROWSER=webkit npm run test:e2e -- tests/game.spec.ts
```

Unit tests run complete deterministic races on every track and CPU difficulty. They cover camera-projected left/right input on every course, tire axes and front-wheel steering, road-edge folding and overpass clearance, jump trajectories, trick timing, landing boosts, all drift levels, item defenses and comeback weighting, checkpoints, lap counting, ranking, braking, collisions, malformed input, reconnection takeover, storage validation and ghost records. Browser tests exercise real rendering, keyboard input, complete races, a full three-course championship, a completed ghost run, split screen, simultaneous touch input, accessible menus and actual WebRTC connections between isolated browser contexts.

Tests use the production build served by Vite preview. Set `PLAYWRIGHT_BASE_URL` to a deployed URL, including its trailing slash, to run against a published build. `tests/capture.mjs` captures the home screen and an actual race. Generated builds, caches, traces and screenshots are ignored by Git.

## GitHub Pages

Choose **Settings → Pages → Source → GitHub Actions** and push to `main`. The workflow checks formatting, unit tests, the production build, Chromium game and network tests, and WebKit game tests before publishing `dist/`.

Vite uses relative asset paths, so the site works under a repository subpath without an account name or repository path in source. Room invitations use the current page URL and a query parameter, so they do not need server-side route rewrites.

## Multiplayer behavior

The host runs the authoritative simulation at 60 fixed steps per second, accepts bounded control inputs and publishes snapshots at 15 Hz. Guests send input at 30 Hz and interpolate remote positions. Ready checks prevent starting until at least two connected people are ready. Up to eight people can join; empty seats are filled by CPU karts.

Host roster membership determines the player that a connection may control. Reconnection requires the same per-tab player token; clients cannot submit their own position or race result. Sequence checks and input rate limits reject stale or excessive control packets. This is a casual private-room game, not a ranked anti-cheat service.

Only the host can pause an online race. Moving the host tab into the background pauses everyone. Returning requires the host to resume. A disconnected guest is driven by the CPU, can reload the same tab and use **Reconnect to previous room**, and receives the current authoritative snapshot. A host reload reopens the room lobby and starts a new session; it does not restore the previous race. Leaving the host closes the room. A finished race waits up to twenty seconds after all humans finish for CPU racers, or up to thirty seconds after the first human finishes for other humans. Remaining racers are classified by progress and marked unfinished.

Default room discovery uses the public PeerJS signaling service; racing data uses a WebRTC data channel. Some restrictive networks or symmetric NATs require a working TURN relay. The connection panel accepts a TURN URL, username and password, and an optional custom PeerServer. Credentials remain in memory and are never stored or included in invitation links. Signaling and TURN availability depend on their providers.

## Rendering and compatibility

WebGL 2 is required. Static geometry is batched by material. Quality settings adjust pixel ratio, antialiasing and shadows; automatic quality uses a lighter profile on narrow screens and devices with few CPU cores. Graphics settings can be changed during a paused race. The app reports context loss and provides a lightweight reload option when rendering cannot start.

Responsive browser tests do not constitute physical iPhone or Android testing. Performance and support depend on the device, browser, graphics driver and network. Course redesigns use a new record namespace so earlier layouts cannot supply incompatible best times or ghosts. Time-attack ghosts and preferences remain local to the current browser; blocked or full browser storage is handled without interrupting a race.

## Source layout

| Path                  | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `src/game/engine.ts`  | Fixed-step racing, AI, ranking and item rules                  |
| `src/game/tracks.ts`  | Closed courses, arc-length sampling and elevation              |
| `src/render/scene.ts` | Three.js scenery, karts, animation and split cameras           |
| `src/lib/runtime.ts`  | Modes, championship, lifecycle, recordings and synchronization |
| `src/lib/network.ts`  | PeerJS rooms, validation, reconnection and host authority      |
| `src/lib/input.ts`    | Keyboard, touch and gamepad controls                           |
| `src/lib/storage.ts`  | Preferences and validated personal records                     |
| `src/components/`     | Course diagrams, dialogs and touch controls                    |
| `tests/`              | Engine, storage, browser and real-network verification         |

Source is available under the repository's MIT license. KARTLINE is an independent kart-racing game and is not affiliated with Nintendo or an official Mario Kart product.

The build also includes `third-party-notices.txt`, containing the licenses and copyright notices of production dependencies, including the DM Sans font. This file is generated from installed packages and is distributed with the site.
