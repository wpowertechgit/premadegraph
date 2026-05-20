using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Input;
using TribalNeuroSim.Client.Launcher;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Net;
using TribalNeuroSim.Client.Protocol;
using TribalNeuroSim.Client.Diagnostics;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Rendering;
using TribalNeuroSim.Client.UI;

namespace TribalNeuroSim.Client;

public sealed class GameRoot : Game
{
    private readonly GraphicsDeviceManager _graphics;
    private readonly LaunchOptions _launchOptions;
    private readonly SimulationConnection _connection;
    private readonly FrameDecoder _frameDecoder;
    private readonly SimulationViewModel _viewModel;
    private readonly AssetRegistry _assetRegistry;
    private readonly ClientDiagnostics _diagnostics;
    private readonly PlayableSimulation _playableSimulation;
    private readonly PlayableRenderAdapter _renderAdapter;
    private readonly IsometricCamera _camera;
    private readonly KeyboardCommandController _commandController;
    private readonly PanelDragController _panelDragController = new();
    private readonly Dictionary<DraggablePanelId, Rectangle> _panelBounds = new();
    private readonly HttpClient _httpClient = new();
    private Net.SimulationControlClient? _controlClient;
    private byte[]? _worldBiomeCache;
    private bool _networkPaused = false;
    private CancellationTokenSource? _receiverCancellation;
    private SimulationFrameReceiver? _frameReceiver;
    private Task? _receiverTask;
    private SpriteBatch? _spriteBatch;
    private WorldRenderer? _worldRenderer;
    private TabletopRenderer? _tabletopRenderer;
    private VegetationRenderer? _vegetationRenderer;
    private SettlementRenderer? _settlementRenderer;
    private BlobShadowRenderer? _blobShadowRenderer;
    private PostProcessRenderer? _postProcessRenderer;
    private BannerRenderer? _bannerRenderer;
    private bool _postProcessEnabled = true;
    private DebugHud? _debugHud;
    private FontRenderer? _panelFontRenderer;
    private SelectionSystem? _selectionSystem;
    private SelectionPanel? _selectionPanel;
    private RuntimeAssetLoader? _runtimeAssets;
    private readonly Dictionary<string, Texture2D> _terrainTextures = new(StringComparer.OrdinalIgnoreCase);

    private KeyboardState _previousKeyboard;
    private MouseState _previousMouse;
    private double _simulationAccumulator;
    private double _titleAccumulator;
    private int _ticksPerSecond = 12;

    // M6: Network mode
    private volatile bool _isNetworkMode;
    private int _mapWidth;
    private int _mapHeight;
    private bool _useNetworkRender;
    private RenderableTile[]? _lastRenderTiles;
    private RenderableTribe[]? _lastRenderTribes;

    // M17: Performance metrics
    private float _smoothedFps;
    private readonly RenderMetrics _renderMetrics = new();
    private double _perfLogAccumulator;

    // M19: Screenshot capture
    private readonly Diagnostics.ScreenshotCapture _screenshotCapture = new();

    // M12E: Isolated viewer state
    private bool _isolatedViewerEnabled;
    private int _isolatedModelIndex;
    private IsometricCamera? _isolatedCamera;

    // M9: Lineage & Tombstone inspection panels
    private readonly LineageInspectorPanel _lineageInspector = new();
    private readonly TombstonePanel _tombstonePanel = new();
    private readonly TombstoneObituaryPanel _obituaryPanel = new();
    private bool _lineagePanelVisible;
    private bool _tombstonePanelVisible;
    private bool _obituaryVisible;
    private int? _obituaryTribeId;

    // Simulation complete / export state
    private string? _lastExportPath;
    private double _exportMessageTimer;

    // ESC menu
    private readonly UI.EscMenu _escMenu = new();

    // Tombstone founder polling (every 8 seconds)
    private double _tombstoneFounderPollTimer;
    private readonly Dictionary<int, IReadOnlyList<string>> _tombstoneFounders = new();
    private Net.TombstonesResponseDto? _serverTombstones;

    public GameRoot(LaunchOptions launchOptions)
    {
        _launchOptions = launchOptions;
        _isNetworkMode = launchOptions.ConnectMode;
        _mapWidth = launchOptions.MapWidth;
        _mapHeight = launchOptions.MapHeight;
        var displayMode = GraphicsAdapter.DefaultAdapter.CurrentDisplayMode;
        var startupBounds = WindowDefaults.ResolveStartupBackBuffer(displayMode.Width, displayMode.Height);
        _graphics = new GraphicsDeviceManager(this)
        {
            PreferredBackBufferWidth = startupBounds.X,
            PreferredBackBufferHeight = startupBounds.Y,
            SynchronizeWithVerticalRetrace = true,
        };
        IsFixedTimeStep = false;

        IsMouseVisible = true;
        Window.AllowUserResizing = true;
        Window.Title = "Tribal NeuroSim";

        _connection = new SimulationConnection();
        _frameDecoder = new FrameDecoder();
        _viewModel = new SimulationViewModel();
        _assetRegistry = AssetRegistry.CreateWithFallbacks();
        _diagnostics = new ClientDiagnostics();
        _playableSimulation = launchOptions.IsDisputeStress
            ? PlayableSimulation.CreateDisputeStress()
            : launchOptions.IsEmpireStress
                ? PlayableSimulation.CreateEmpireStress()
                : PlayableSimulation.CreateDemo();

        // M18C/M18B: Stress presets use a farther-out camera to fit larger maps
        if (launchOptions.IsDisputeStress)
        {
            _camera = new IsometricCamera
            {
                FocalPoint = new Vector3(180f, 0f, 130f),
                Distance = 420f,
                Pitch = MathHelper.ToRadians(35f),
            };
        }
        else if (launchOptions.IsEmpireStress)
        {
            _camera = new IsometricCamera
            {
                FocalPoint = new Vector3(280f, 0f, 200f),
                Distance = 480f,
                Pitch = MathHelper.ToRadians(35f),
            };
        }
        else
        {
            _camera = new IsometricCamera
            {
                FocalPoint = new Vector3(220f, 0f, 160f),
                Distance = 400f,
                Pitch = MathHelper.ToRadians(35f),
            };
        }

        _renderAdapter = new PlayableRenderAdapter();
        _commandController = new KeyboardCommandController();

        // Network mode: increase camera range for large maps (55×55 → ~2700 world units wide)
        if (launchOptions.ConnectMode)
        {
            _camera.MaxDistance = 4000f;
            _camera.Distance = 1200f;
        }
    }

    protected override void Initialize()
    {
        Window.Position = Point.Zero;
        _graphics.ApplyChanges();
        _receiverCancellation = new CancellationTokenSource();
        _receiverTask = Task.Run(() => ConnectAndReceiveFramesAsync(_receiverCancellation.Token));

        base.Initialize();
    }

    protected override void LoadContent()
    {
        _spriteBatch = new SpriteBatch(GraphicsDevice);
        _worldRenderer = new WorldRenderer();
        _tabletopRenderer = new TabletopRenderer();
        _tabletopRenderer.Initialize(GraphicsDevice);
        _tabletopRenderer.EnsureParchmentTexture(GraphicsDevice);
        _debugHud = new DebugHud();
        _panelFontRenderer = new FontRenderer(GraphicsDevice, FontRole.Display);
        _selectionSystem = new SelectionSystem(tileSize: 28f);
        _selectionPanel = new SelectionPanel();
        _runtimeAssets = new RuntimeAssetLoader(GraphicsDevice);
        _vegetationRenderer = new VegetationRenderer(GraphicsDevice);
        _settlementRenderer = new SettlementRenderer(GraphicsDevice);
        // Network maps are large; keep 3D settlement LOD conservative so zooming
        // into a 599-tribe dataset does not promote the whole viewport at once.
        if (_launchOptions.ConnectMode)
            _settlementRenderer.SetLodDistanceScale(1.35f);
        _blobShadowRenderer = new BlobShadowRenderer();
        _blobShadowRenderer.Initialize(GraphicsDevice);
        _postProcessRenderer = new PostProcessRenderer();
        Window.ClientSizeChanged += OnClientSizeChanged;
        _bannerRenderer = new BannerRenderer();
        if (_runtimeAssets is not null)
            _bannerRenderer.Initialize(GraphicsDevice, _runtimeAssets, _panelFontRenderer);
        LoadRuntimeTextures();

        LoadVegetationModels();
        LoadSettlementModels();
        base.LoadContent();
    }

    protected override void Update(GameTime gameTime)
    {
        var keyboard = Keyboard.GetState();
        var mouse = Mouse.GetState();
        var commands = _commandController.ReadCommands(keyboard, _previousKeyboard, mouse, _previousMouse);

        if (commands.QuitRequested)
        {
            if (_escMenu.IsOpen)
                _escMenu.Close();
            else
                _escMenu.Toggle();
        }

        // Handle ESC menu mouse clicks
        if (_escMenu.IsOpen)
        {
            var mb = Mouse.GetState();
            var prevMb = _previousMouse;
            if (mb.LeftButton == Microsoft.Xna.Framework.Input.ButtonState.Pressed
                && prevMb.LeftButton == Microsoft.Xna.Framework.Input.ButtonState.Released)
            {
                _escMenu.HandleMouseClick(mb.X, mb.Y);
            }
            if (_escMenu.ExitRequested) { Exit(); return; }
            // Block all other input while menu open
            _previousKeyboard = keyboard;
            _previousMouse = mb;
            return;
        }

        // M4: Compute map bounds from simulation grid and clamp camera focal point.
        // TileCenter maps old 2D coords: X→right, Y→down → 3D: X→X, Y→Z.
        // topLeft has low Z, bottomRight has high Z.
        {
            var mapW = _isNetworkMode && _mapWidth > 0 ? _mapWidth : _playableSimulation.Width;
            var mapH = _isNetworkMode && _mapHeight > 0 ? _mapHeight : _playableSimulation.Height;
            var topLeft = _renderAdapter.TileCenter(0, 0);
            var bottomRight = _renderAdapter.TileCenter(mapW - 1, mapH - 1);
            var pad = _renderAdapter.TileSize * 1.5f;
            _camera.SetMapBounds(
                minX: topLeft.X - pad,
                minZ: topLeft.Y - pad,
                maxX: bottomRight.X + pad,
                maxZ: bottomRight.Y + pad);
        }

        _camera.Update(gameTime, keyboard, mouse, _previousMouse, GraphicsDevice.Viewport);
        _panelDragController.Update(mouse, _previousMouse, GraphicsDevice.Viewport, _panelBounds);
        HandlePlayableInput(commands);

        // M5: Toggle V3 stats panel with 'V' key
        if (KeyPressedOnce(keyboard, _previousKeyboard, Keys.V) && _debugHud is not null)
            _debugHud.ShowV3Stats = !_debugHud.ShowV3Stats;

        UpdatePlayableSimulation(gameTime);
        DrainReceivedFrames();
        PollTombstoneFounders(gameTime);
        UpdateWindowTitle(gameTime);

        if (_exportMessageTimer > 0)
            _exportMessageTimer -= gameTime.ElapsedGameTime.TotalSeconds;

        _previousKeyboard = keyboard;
        _previousMouse = mouse;
        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        // M17: FPS tracking (exponential moving average, α ≈ 0.1, ~0.5s smoothing at 60fps)
        var dt = (float)gameTime.ElapsedGameTime.TotalSeconds;
        if (dt > 0.0001f)
        {
            var instantFps = 1f / dt;
            _smoothedFps = _smoothedFps <= 0f
                ? instantFps
                : _smoothedFps + 0.10f * (instantFps - _smoothedFps);
        }

        GraphicsDevice.Clear(new Color(74, 54, 33)); // warm wood-table fallback, no black void

        // M12E: Isolated viewer renders one model at origin with a fixed camera
        if (_isolatedViewerEnabled)
        {
            DrawIsolatedViewer(gameTime);
            UpdateRenderMetrics(0, default, 0);
            return;
        }

        if (_spriteBatch is not null && _worldRenderer is not null)
        {
            // M19: Screenshot capture — override camera for deterministic zoom levels
            var originalDistance = _camera.Distance;
            var originalFocalPoint = _camera.FocalPoint;
            var originalYaw = _camera.Yaw;
            var originalPitch = _camera.Pitch;

            if (_screenshotCapture.IsCapturing)
            {
                _camera.FocalPoint = _screenshotCapture.OverrideFocalPoint;
                _camera.Distance = _screenshotCapture.OverrideDistance;
                _camera.Yaw = MathHelper.ToRadians(35f);
                _camera.Pitch = MathHelper.ToRadians(35f);
            }

            var captureRt = _screenshotCapture.BeginDraw(GraphicsDevice);
            var usePostProcess = _postProcessEnabled && captureRt is null;

            if (usePostProcess)
            {
                var vp = GraphicsDevice.Viewport;
                _postProcessRenderer!.EnsureTargets(GraphicsDevice, vp.Width, vp.Height);
                GraphicsDevice.SetRenderTarget(_postProcessRenderer.SceneTarget);
                GraphicsDevice.Clear(new Color(74, 54, 33));
            }
            else if (captureRt is not null)
            {
                GraphicsDevice.SetRenderTarget(captureRt);
            }

            // M6: In network mode with V1 data, render from Rust frame data.
            // Otherwise render the local PlayableSimulation demo.
            _useNetworkRender = _isNetworkMode && _mapWidth > 0 && (_viewModel.HasV1Data || _worldBiomeCache is not null);

            var tiles = _useNetworkRender
                ? _renderAdapter.BuildTiles(_viewModel, _mapWidth, _mapHeight, _worldBiomeCache).ToArray()
                : _renderAdapter.BuildTiles(_playableSimulation).ToArray();
            var tribes = _useNetworkRender
                ? _renderAdapter.BuildTribes(_viewModel, _mapWidth).ToArray()
                : _renderAdapter.BuildTribes(_playableSimulation).ToArray();
            _lastRenderTiles = tiles;
            _lastRenderTribes = tribes;
            var selectedTribeId = _useNetworkRender
                ? (_playableSimulation.SelectedTribeId >= 0 ? _playableSimulation.SelectedTribeId : -1)
                : _playableSimulation.SelectedTribeId;

            // 0. Table and parchment under the map (world-space 3D presentation).
            if (_tabletopRenderer is not null)
            {
                var mapMinX = float.MaxValue;
                var mapMinZ = float.MaxValue;
                var mapMaxX = float.MinValue;
                var mapMaxZ = float.MinValue;
                foreach (var tile in tiles)
                {
                    var r = tile.Size;
                    mapMinX = MathF.Min(mapMinX, tile.Center.X - r);
                    mapMaxX = MathF.Max(mapMaxX, tile.Center.X + r);
                    mapMinZ = MathF.Min(mapMinZ, tile.Center.Y - r);
                    mapMaxZ = MathF.Max(mapMaxZ, tile.Center.Y + r);
                }

                _tabletopRenderer.Draw(GraphicsDevice, _camera, mapMinX, mapMinZ, mapMaxX, mapMaxZ);
            }

            // 1. Hex terrain tiles (heightmap relief, no chunk models) and territory borders.
            _worldRenderer.DrawTerrainLayers(
                _spriteBatch,
                tiles,
                _camera);

            // 2. Vegetation dressing.
            if (_useNetworkRender)
            {
                _vegetationRenderer?.CollectInstances(tiles, tribes, _assetRegistry, _camera.Distance);
            }
            else
            {
                _vegetationRenderer?.CollectInstances(_playableSimulation, _assetRegistry, _camera.Distance);
            }
            _vegetationRenderer?.Render(_camera, GraphicsDevice, (float)gameTime.TotalGameTime.TotalSeconds);

            // 2.5 Blob ground shadows under settlement models (screen-space, after terrain, before models).
            if (_settlementRenderer is not null && _blobShadowRenderer is not null)
            {
                _blobShadowRenderer.DrawShadows(
                    GraphicsDevice,
                    _settlementRenderer.DrawList,
                    _camera,
                    GraphicsDevice.Viewport,
                    selectedTribeId);
            }

            // 3. Settlement 3D models on capital tiles (LOD-aware).
            if (_useNetworkRender)
            {
                _settlementRenderer?.CollectInstances(tribes, tiles, _assetRegistry);
            }
            else
            {
                _settlementRenderer?.CollectInstances(_playableSimulation, _assetRegistry);
            }
            _settlementRenderer?.Render(GraphicsDevice, _camera, selectedTribeId);

            // 3.5 Faction banners at mid-to-far zoom (M8).
            if (_bannerRenderer is not null)
            {
                _bannerRenderer.DrawBanners(
                    _spriteBatch,
                    tribes,
                    _camera,
                    GraphicsDevice.Viewport,
                    _assetRegistry);
            }

            // 4. Readable tribe/camp symbols above 3D scene dressing.
            _worldRenderer.DrawSymbolOverlays(
                _spriteBatch,
                tiles,
                tribes,
                _camera,
                selectedTribeId);

            // 5. War indicator lines (network mode only — wars come from V1 frame)
            if (_useNetworkRender && _viewModel.Wars.Count > 0)
            {
                var tribePositionById = new Dictionary<uint, Microsoft.Xna.Framework.Vector2>();
                foreach (var tribe in tribes)
                    tribePositionById[(uint)tribe.Id] = tribe.Position;

                var warPairs = new List<(Microsoft.Xna.Framework.Vector2, Microsoft.Xna.Framework.Vector2)>();
                foreach (var war in _viewModel.Wars)
                {
                    if (tribePositionById.TryGetValue(war.AttackerId, out var atk)
                        && tribePositionById.TryGetValue(war.DefenderId, out var def))
                    {
                        warPairs.Add((atk, def));
                    }
                }

                if (warPairs.Count > 0)
                    _worldRenderer.DrawWarLines(_spriteBatch, warPairs, _camera, _viewModel.Tick);
            }

            // Restore back buffer before post-process / screenshot finalize
            GraphicsDevice.SetRenderTarget(null);

            // M22: Apply post-process (warm tint + vignette) when enabled and not capturing
            if (usePostProcess)
                _postProcessRenderer!.Apply(GraphicsDevice);

            // M19: End screenshot capture frame if active (saves PNG, presents to back buffer)
            if (captureRt is not null)
            {
                _screenshotCapture.EndDraw(GraphicsDevice, captureRt, _spriteBatch);
            }

            // Restore camera after capture override
            if (_screenshotCapture.IsCapturing || originalDistance != _camera.Distance)
            {
                _camera.FocalPoint = originalFocalPoint;
                _camera.Distance = originalDistance;
                _camera.Yaw = originalYaw;
                _camera.Pitch = originalPitch;
            }

            // M17: Collect render metrics
            UpdateRenderMetrics(
                _worldRenderer?.LastTerrainTilesDrawn ?? 0,
                _settlementRenderer?.LastStats ?? default,
                _vegetationRenderer?.BatchTotalInstances ?? 0);
            LogNetworkRenderMetrics(gameTime);

            if (_selectionPanel is not null && _panelFontRenderer is not null)
            {
                var defaultSelectionOrigin = new Point(GraphicsDevice.Viewport.Width - SelectionPanel.PanelWidth - 12, 12);
                var panelOrigin = _panelDragController.ResolveOrigin(DraggablePanelId.Selection, defaultSelectionOrigin);

                if (_useNetworkRender && _viewModel.HasV1Data)
                {
                    Protocol.TribeFrameV1Record? selectedV1 = null;
                    if (_playableSimulation.SelectedTribeId >= 0)
                        _viewModel.V1Tribes.TryGetValue((uint)_playableSimulation.SelectedTribeId, out selectedV1);

                    Rendering.RenderableTile? selectedTileRenderable = null;
                    if (_playableSimulation.SelectedTileId >= 0 && _lastRenderTiles is not null
                        && _playableSimulation.SelectedTileId < _lastRenderTiles.Length)
                        selectedTileRenderable = _lastRenderTiles[_playableSimulation.SelectedTileId];

                    _selectionPanel.DrawNetwork(
                        _spriteBatch,
                        selectedV1,
                        selectedTileRenderable,
                        _panelFontRenderer,
                        panelOrigin);
                }
                else
                {
                    _selectionPanel.Draw(
                        _spriteBatch,
                        _playableSimulation,
                        _panelFontRenderer,
                        panelOrigin);
                }
            }

            // M9: Lineage inspector (toggled with L)
            if (_panelFontRenderer is not null)
            {
                var defaultLineageOrigin = new Point(GraphicsDevice.Viewport.Width - 660, 12);
                var lineageOrigin = _panelDragController.ResolveOrigin(DraggablePanelId.Lineage, defaultLineageOrigin);

                if (_useNetworkRender && _viewModel.HasV1Data)
                {
                    Protocol.TribeFrameV1Record? selectedV1ForLineage = null;
                    if (_playableSimulation.SelectedTribeId >= 0)
                        _viewModel.V1Tribes.TryGetValue((uint)_playableSimulation.SelectedTribeId, out selectedV1ForLineage);

                    _lineageInspector.DrawNetwork(
                        _spriteBatch,
                        selectedV1ForLineage,
                        _panelFontRenderer,
                        lineageOrigin,
                        _lineagePanelVisible);
                }
                else
                {
                    _lineageInspector.Draw(
                        _spriteBatch,
                        _playableSimulation,
                        _panelFontRenderer,
                        lineageOrigin,
                        _lineagePanelVisible);
                }
            }

            // M9: Tombstone ledger (toggled with K) — positioned below debug HUD
            if (_panelFontRenderer is not null)
            {
                var tombstoneOrigin = _panelDragController.ResolveOrigin(DraggablePanelId.Tombstone, new Point(12, 280));
                if (_useNetworkRender)
                {
                    _tombstonePanel.DrawNetwork(
                        _spriteBatch,
                        _serverTombstones,
                        _panelFontRenderer,
                        tombstoneOrigin,
                        _tombstonePanelVisible);
                }
                else
                {
                    _tombstonePanel.Draw(
                        _spriteBatch,
                        _playableSimulation,
                        _panelFontRenderer,
                        tombstoneOrigin,
                        _tombstonePanelVisible);
                }
            }

            // Obituary popup (shown when a tombstone row is clicked)
            if (_obituaryVisible && _obituaryTribeId.HasValue && _panelFontRenderer is not null)
            {
                var defaultObituaryOrigin = new Point(
                    GraphicsDevice.Viewport.Width / 2 - 190,
                    GraphicsDevice.Viewport.Height / 2 - 200);
                var obituaryOrigin = _panelDragController.ResolveOrigin(DraggablePanelId.Obituary, defaultObituaryOrigin);

                if (_useNetworkRender)
                {
                    var netRec = _serverTombstones?.Records
                        .FirstOrDefault(r => (int)r.TribeId == _obituaryTribeId.Value);
                    if (netRec is not null)
                        _obituaryPanel.DrawNetwork(_spriteBatch, netRec, _panelFontRenderer, obituaryOrigin);
                    else
                        _obituaryVisible = false;
                }
                else
                {
                    var tombstone = _playableSimulation.Tombstones
                        .FirstOrDefault(t => t.TribeId == _obituaryTribeId.Value);
                    if (tombstone is not null)
                    {
                        var tribeNameForObit = _playableSimulation.Tribes
                            .FirstOrDefault(t => t.Id == tombstone.TribeId)?.Name
                            ?? $"Tribe {tombstone.TribeId}";
                        string? absorbedByName = null;
                        if (tombstone.AbsorbedByTribeId.HasValue)
                            absorbedByName = _playableSimulation.Tribes
                                .FirstOrDefault(t => t.Id == tombstone.AbsorbedByTribeId.Value)?.Name
                                ?? $"Tribe {tombstone.AbsorbedByTribeId.Value}";

                        _obituaryPanel.Draw(
                            _spriteBatch,
                            tombstone,
                            tribeNameForObit,
                            absorbedByName,
                            _panelFontRenderer,
                            obituaryOrigin);
                    }
                    else
                    {
                        _obituaryVisible = false;
                    }
                }
            }

            // Simulation complete banner and export hint
            if (!_isNetworkMode && _playableSimulation.IsSimulationComplete && _panelFontRenderer is not null)
            {
                var winner = _playableSimulation.Tribes.FirstOrDefault(t => t.IsAlive);
                if (winner is not null)
                    DrawSimulationCompleteBanner(_spriteBatch, _panelFontRenderer, winner.Name);
            }

            // Export success toast
            if (_exportMessageTimer > 0 && _lastExportPath is not null && _panelFontRenderer is not null)
            {
                DrawExportToast(_spriteBatch, _panelFontRenderer, _lastExportPath);
            }

            if (_debugHud is not null)
            {
                _debugHud.ReservedTopRightPanel = _selectionPanel?.LastBounds;
                var defaultPerformancePanel = DebugHud.ResolvePerformancePanelBounds(GraphicsDevice.Viewport, _selectionPanel?.LastBounds);
                _debugHud.PerformancePanelOriginOverride = _panelDragController.ResolveOrigin(DraggablePanelId.Performance, defaultPerformancePanel.Location);
                _debugHud.Draw(
                    _spriteBatch,
                    BuildHudState(),
                    _panelDragController.ResolveOrigin(DraggablePanelId.DebugHud, new Point(12, 12)));
            }

            UpdatePanelBounds();

            // ESC menu drawn last so it overlays everything
            if (_escMenu.IsOpen)
            {
                var ms = Mouse.GetState();
                _escMenu.Draw(_spriteBatch, ms.X, ms.Y);
            }
        }

        base.Draw(gameTime);
    }

    private void DrawSimulationCompleteBanner(SpriteBatch sb, FontRenderer font, string winnerName)
    {
        var vp = GraphicsDevice.Viewport;
        var lh = font.LineHeight(FontSize.Header);
        var sh = font.LineHeight(FontSize.Small);
        var bannerH = lh + sh + 20;
        var bannerRect = new Rectangle(0, 0, vp.Width, bannerH);

        sb.Begin(sortMode: SpriteSortMode.Deferred, blendState: BlendState.AlphaBlend, samplerState: SamplerState.LinearClamp);

        using var pixel = new Texture2D(GraphicsDevice, 1, 1);
        pixel.SetData(new[] { Color.White });

        sb.Draw(pixel, bannerRect, new Color(10, 18, 10, 210));
        sb.Draw(pixel, new Rectangle(0, bannerH - 2, vp.Width, 2), new Color(100, 220, 130, 180));

        var title = $"SIMULATION COMPLETE  ─  {winnerName.ToUpperInvariant()} SURVIVES";
        font.DrawString(sb, title, new Vector2(12, 6), FontSize.Header, new Color(120, 255, 140, 240));

        var hint = "Press E to export run data as JSON  |  Press K for tombstone ledger";
        font.DrawString(sb, hint, new Vector2(12, 6 + lh + 2), FontSize.Small, new Color(140, 180, 140, 180));

        sb.End();
    }

    private void DrawExportToast(SpriteBatch sb, FontRenderer font, string path)
    {
        var vp = GraphicsDevice.Viewport;
        var sh = font.LineHeight(FontSize.Small);
        var toastH = sh + 16;
        var toastRect = new Rectangle(0, vp.Height - toastH, vp.Width, toastH);

        sb.Begin(sortMode: SpriteSortMode.Deferred, blendState: BlendState.AlphaBlend, samplerState: SamplerState.LinearClamp);

        using var pixel = new Texture2D(GraphicsDevice, 1, 1);
        pixel.SetData(new[] { Color.White });

        sb.Draw(pixel, toastRect, new Color(10, 28, 10, 200));
        var msg = $"Exported: {path}";
        font.DrawString(sb, msg, new Vector2(10, vp.Height - toastH + 8), FontSize.Small, new Color(100, 220, 130, 230));

        sb.End();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _receiverCancellation?.Cancel();

            try
            {
                _receiverTask?.GetAwaiter().GetResult();
            }
            catch (OperationCanceledException)
            {
            }
            catch (AggregateException ex) when (ex.InnerExceptions.All(inner => inner is OperationCanceledException))
            {
            }

            _receiverCancellation?.Dispose();
            _connection.DisposeAsync().AsTask().GetAwaiter().GetResult();
            _httpClient.Dispose();
            _worldRenderer?.Dispose();
            _tabletopRenderer?.Dispose();
            _vegetationRenderer?.Dispose();
            _settlementRenderer?.Dispose();
            _blobShadowRenderer?.Dispose();
            _postProcessRenderer?.Dispose();
            _bannerRenderer?.Dispose();
            _debugHud?.Dispose();
            _escMenu.Dispose();
            _panelFontRenderer?.Dispose();
            _runtimeAssets?.Dispose();
            _spriteBatch?.Dispose();
            // M9 panel resources freed by GC (Texture2D/FontRenderer owned by panels)
            _graphics.Dispose();
        }

        base.Dispose(disposing);
    }

    public LaunchOptions LaunchOptions => _launchOptions;

    public SimulationViewModel ViewModel => _viewModel;

    public AssetRegistry AssetRegistry => _assetRegistry;

    public FrameDecoder FrameDecoder => _frameDecoder;

    public ClientDiagnostics Diagnostics => _diagnostics;

    private async Task ConnectAndReceiveFramesAsync(CancellationToken cancellationToken)
    {
        const int MaxAttempts = 4;
        const int RetryDelayMs = 2000;

        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                attemptCts.CancelAfter(TimeSpan.FromSeconds(5));

                await _connection.ConnectAsync(_launchOptions.NodeWebSocketEndpoint, attemptCts.Token)
                    .ConfigureAwait(false);

                _diagnostics.RecordConnectionOpened(_launchOptions.NodeWebSocketEndpoint);
                _isNetworkMode = true;

                _controlClient = new Net.SimulationControlClient(_httpClient, _launchOptions.NodeHttpEndpoint);
                await FetchWorldSnapshotAsync(cancellationToken).ConfigureAwait(false);
                // Fetch tombstones immediately on connect — don't wait 8 seconds for first poll
                _ = FetchTombstoneFoundersAsync();
                _settlementRenderer?.SetLodDistanceScale(1.35f);

                // Pause simulation on connect so user starts from a known state
                try
                {
                    var status = await _controlClient.GetStatusAsync(cancellationToken).ConfigureAwait(false);
                    _networkPaused = status?.Paused ?? false;
                    if (!_networkPaused)
                    {
                        await _controlClient.PauseAsync(cancellationToken).ConfigureAwait(false);
                        _networkPaused = true;
                        Console.WriteLine("[ctrl] auto-paused on connect");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ctrl] auto-pause failed: {ex.Message}");
                }

                _frameReceiver = new SimulationFrameReceiver(
                    _connection.ReceiveBinaryFrameAsync,
                    payload => _frameDecoder.Decode(payload),
                    _diagnostics);

                await _frameReceiver.RunAsync(cancellationToken).ConfigureAwait(false);
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex) when (attempt < MaxAttempts)
            {
                _diagnostics.RecordConnectionError(_launchOptions.NodeWebSocketEndpoint, ex);
                await Task.Delay(RetryDelayMs, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _diagnostics.RecordConnectionError(_launchOptions.NodeWebSocketEndpoint, ex);
            }
        }
    }

    private async Task FetchWorldSnapshotAsync(CancellationToken cancellationToken)
    {
        try
        {
            var snapshot = await _controlClient!.GetWorldSnapshotAsync(cancellationToken).ConfigureAwait(false);
            if (snapshot is null) return;

            _mapWidth = snapshot.Width;
            _mapHeight = snapshot.Height;

            var cache = new byte[snapshot.Tiles.Count];
            for (var i = 0; i < snapshot.Tiles.Count; i++)
                cache[i] = (byte)PlayableRenderAdapter.RustBiomeToBiomeId(snapshot.Tiles[i].Biome);
            _worldBiomeCache = cache;

            Console.WriteLine($"[world] snapshot loaded: {snapshot.Width}×{snapshot.Height}, {snapshot.Tiles.Count} tiles, seed={snapshot.Seed}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[world] snapshot fetch failed: {ex.Message}");
        }
    }

    private void PollTombstoneFounders(GameTime gameTime)
    {
        if (!_isNetworkMode || _controlClient is null) return;

        _tombstoneFounderPollTimer += gameTime.ElapsedGameTime.TotalSeconds;
        if (_tombstoneFounderPollTimer < 8.0) return;
        _tombstoneFounderPollTimer = 0;

        // Fire-and-forget; result is applied when ready
        _ = FetchTombstoneFoundersAsync();
    }

    private async Task FetchTombstoneFoundersAsync()
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var response = await _controlClient!.GetTombstonesAsync(cts.Token).ConfigureAwait(false);
            if (response?.Records is null) return;

            _serverTombstones = response;

            foreach (var rec in response.Records)
                _tombstoneFounders[(int)rec.TribeId] = rec.FounderPuuids.AsReadOnly();

            _tombstonePanel.SetFounders(_tombstoneFounders);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[tombstone] fetch failed: {ex.GetType().Name}: {ex.Message}");
        }
    }

    private void DrainReceivedFrames()
    {
        if (_frameReceiver is null)
        {
            return;
        }

        while (_frameReceiver.TryDequeueFrame(out var frame))
        {
            _viewModel.ApplyFrame(frame);

            // M6: Derive map dimensions from tile data if not explicitly configured
            if (_isNetworkMode && _mapWidth <= 0 && _viewModel.TileData.Count > 0)
            {
                var maxTileId = _viewModel.TileData.Keys.Max();
                var totalCells = (int)maxTileId + 1;
                if (_mapHeight > 0)
                {
                    _mapWidth = totalCells / _mapHeight;
                }
                else
                {
                    _mapHeight = (int)MathF.Sqrt(totalCells);
                    _mapWidth = totalCells / _mapHeight;
                }
            }

            // 2026-05-10: Fit camera to map bounds on first usable network frame
            // so large grids (e.g. 122x123 with 425 tribes) frame the whole world
            // instead of leaving the playfield piled into the bottom-right corner.
            if (_isNetworkMode && !_didFitNetworkCamera && _mapWidth > 0 && _mapHeight > 0)
            {
                var topLeft = _renderAdapter.TileCenter(0, 0);
                var bottomRight = _renderAdapter.TileCenter(_mapWidth - 1, _mapHeight - 1);
                var worldW = bottomRight.X - topLeft.X;
                var worldH = bottomRight.Y - topLeft.Y;
                _camera.MaxDistance = MathF.Max(_camera.MaxDistance, MathF.Max(worldW, worldH) * 1.4f);
                _camera.FocalPoint = new Vector3(
                    (topLeft.X + bottomRight.X) * 0.5f,
                    0f,
                    (topLeft.Y + bottomRight.Y) * 0.5f);
                _camera.Distance = MathHelper.Clamp(
                    MathF.Max(worldW, worldH) * 0.85f,
                    _camera.MinDistance,
                    _camera.MaxDistance);
                _didFitNetworkCamera = true;
            }
        }
    }

    private bool _didFitNetworkCamera;

    private void HandlePlayableInput(PlayableCommandSet commands)
    {
        if (commands.ToggleFullscreen)
        {
            ToggleFullscreen();
        }

        if (commands.TogglePause)
        {
            if (_isNetworkMode && _controlClient is not null)
            {
                var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                if (_networkPaused)
                {
                    _networkPaused = false;
                    _ = _controlClient.ResumeAsync(cts.Token)
                        .ContinueWith(t => { if (t.IsFaulted) Console.WriteLine($"[ctrl] resume failed: {t.Exception?.GetBaseException().Message}"); });
                }
                else
                {
                    _networkPaused = true;
                    _ = _controlClient.PauseAsync(cts.Token)
                        .ContinueWith(t => { if (t.IsFaulted) Console.WriteLine($"[ctrl] pause failed: {t.Exception?.GetBaseException().Message}"); });
                }
            }
            else
            {
                _playableSimulation.IsPaused = !_playableSimulation.IsPaused;
            }
        }

        if (commands.StepTick)
        {
            if (_isNetworkMode && _controlClient is not null)
            {
                var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                _ = _controlClient.StepTickAsync(cts.Token)
                    .ContinueWith(t => { if (t.IsFaulted) Console.WriteLine($"[ctrl] step-tick failed: {t.Exception?.GetBaseException().Message}"); });
            }
            else
            {
                _playableSimulation.Step();
            }
        }

        if (commands.Reset)
        {
            if (_isNetworkMode && _controlClient is not null)
            {
                var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                _ = _controlClient.ResetAsync(cts.Token)
                    .ContinueWith(t => { if (t.IsFaulted) Console.WriteLine($"[ctrl] reset failed: {t.Exception?.GetBaseException().Message}"); });
            }
            else
            {
                _playableSimulation.Reset();
            }
        }

        if (commands.ForceDispute)
        {
            _playableSimulation.ForceDispute();
        }

        if (commands.SelectNext)
        {
            SelectNextTribe();
        }

        if (commands.SpeedUp)
        {
            _ticksPerSecond = Math.Min(60, _ticksPerSecond + 2);
        }

        if (commands.SlowDown)
        {
            _ticksPerSecond = Math.Max(1, _ticksPerSecond - 2);
        }

        if (commands.SelectAtScreenPosition && commands.SelectionScreenPosition is { } screenPosition)
        {
            var mx = (int)screenPosition.X;
            var my = (int)screenPosition.Y;
            var clickedPanel = false;

            // Obituary close button
            if (_obituaryVisible && _obituaryPanel.LastBounds != Microsoft.Xna.Framework.Rectangle.Empty
                && _obituaryPanel.LastBounds.Contains(mx, my))
            {
                if (_obituaryPanel.HandleMouseClick(mx, my))
                    _obituaryVisible = false;
                clickedPanel = true;
            }

            // Route click to tombstone panel
            if (!clickedPanel && _tombstonePanelVisible
                && _tombstonePanel.LastBounds != Microsoft.Xna.Framework.Rectangle.Empty
                && _tombstonePanel.LastBounds.Contains(mx, my))
            {
                _tombstonePanel.HandleMouseClick(mx, my);
                if (_tombstonePanel.ObituaryRequested)
                {
                    _obituaryTribeId = _tombstonePanel.SelectedTombstoneTribeId;
                    _obituaryVisible = true;
                    _tombstonePanel.ConsumeObituaryRequest();
                }
                clickedPanel = true;
            }

            if (!clickedPanel && !_panelDragController.ConsumesPointer)
                SelectTribeAtScreenPosition(screenPosition);
        }

        if (commands.ToggleIsolatedViewer)
        {
            ToggleIsolatedViewer();
        }

        if (commands.TogglePostProcess)
        {
            _postProcessEnabled = !_postProcessEnabled;
        }

        if (commands.CaptureScreenshots)
        {
            // Compute map center from current tiles
            var tiles = _renderAdapter.BuildTiles(_playableSimulation).ToArray();
            if (tiles.Length > 0)
            {
                var minX = float.MaxValue;
                var maxX = float.MinValue;
                var minZ = float.MaxValue;
                var maxZ = float.MinValue;
                foreach (var t in tiles)
                {
                    minX = MathF.Min(minX, t.Center.X);
                    maxX = MathF.Max(maxX, t.Center.X);
                    minZ = MathF.Min(minZ, t.Center.Y);
                    maxZ = MathF.Max(maxZ, t.Center.Y);
                }
                var mapCenter = new Vector3((minX + maxX) * 0.5f, 0f, (minZ + maxZ) * 0.5f);
                _screenshotCapture.QueueCapture(mapCenter);
            }
        }

        // M9: Lineage inspector toggle
        if (commands.ToggleLineageInspector)
        {
            _lineagePanelVisible = !_lineagePanelVisible;
        }

        // M18C: Force dispute creation between two neighboring tribes for visual testing
        if (commands.ForceDispute)
        {
            var forcedTileId = _playableSimulation.ForceDispute();
            if (forcedTileId >= 0 && _playableSimulation.DisputedTileCount > 0)
            {
                var tile = _playableSimulation.Tiles[forcedTileId];
                if (tile.Controls.Count > 0)
                    _playableSimulation.SelectedTribeId = tile.Controls[0].TribeId;
            }
        }

        // M9: Tombstone panel toggle
        if (commands.ToggleTombstonePanel)
        {
            _tombstonePanelVisible = !_tombstonePanelVisible;
            if (_tombstonePanelVisible)
                _tombstonePanel.ResetScroll();
        }

        // Export simulation run (E key)
        if (commands.ExportSimulation && !_isNetworkMode)
        {
            try
            {
                _lastExportPath = Models.SimulationExporter.SaveToFile(_playableSimulation);
                _exportMessageTimer = 5.0;
                Console.WriteLine($"[export] saved to {_lastExportPath}");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[export] failed: {ex.Message}");
            }
        }

        // M9: Tombstone panel sort/scroll forwarded to panel
        _tombstonePanel.HandleInput(
            nextSortRequested: commands.TombstoneCycleSort,
            prevSortRequested: false,
            scrollUp: commands.TombstoneScrollUp,
            scrollDown: commands.TombstoneScrollDown,
            totalTombstones: _playableSimulation.Tombstones.Count);

        // M12E: Cycle isolated model with arrow keys when viewer active
        if (_isolatedViewerEnabled)
        {
            var vegKeys = _vegetationRenderer?.LoadedModelKeys ?? Array.Empty<string>();
            var settlementKeys = _settlementRenderer?.LoadedModelKeys ?? Array.Empty<string>();
            var allKeys = vegKeys.Concat(settlementKeys).ToArray();

            var kbd = Keyboard.GetState();
            if (KeyPressedOnce(kbd, _previousKeyboard, Keys.Right))
            {
                if (allKeys.Length > 0)
                    _isolatedModelIndex = (_isolatedModelIndex + 1) % allKeys.Length;
            }
            else if (KeyPressedOnce(kbd, _previousKeyboard, Keys.Left))
            {
                if (allKeys.Length > 0)
                    _isolatedModelIndex = (_isolatedModelIndex - 1 + allKeys.Length) % allKeys.Length;
            }
        }
    }

    private void UpdatePlayableSimulation(GameTime gameTime)
    {
        // Network mode (--connect): Rust is the simulation authority.
        // PlayableSimulation does not step — all tribe state comes from FrameV1 frames.
        // This is the production path. Do not add behavior logic here for network results.
        if (_isNetworkMode)
        {
            return;
        }

        // Local demo mode: PlayableSimulation steps here.
        // This is a visual harness only — see the HARNESS-ONLY banner in PlayableSimulation.cs.

        if (_playableSimulation.IsPaused)
        {
            return;
        }

        _simulationAccumulator += gameTime.ElapsedGameTime.TotalSeconds;
        var interval = 1.0 / Math.Max(1, _ticksPerSecond);

        while (_simulationAccumulator >= interval)
        {
            _playableSimulation.Step();
            _simulationAccumulator -= interval;
        }
    }

    private void SelectNextTribe()
    {
        var living = _playableSimulation.Tribes
            .Where(tribe => tribe.IsAlive)
            .OrderBy(tribe => tribe.Id)
            .ToArray();

        if (living.Length == 0)
        {
            _playableSimulation.SelectedTribeId = -1;
            _playableSimulation.SelectedTileId = -1;
            return;
        }

        var currentIndex = Array.FindIndex(living, tribe => tribe.Id == _playableSimulation.SelectedTribeId);
        var next = living[(currentIndex + 1 + living.Length) % living.Length];
        _playableSimulation.SelectedTribeId = next.Id;
        _playableSimulation.SelectedTileId = next.MainCampTileId;
    }

    private void SelectTribeAtScreenPosition(Vector2 screenPosition)
    {
        if (_selectionSystem is null) return;

        if (_useNetworkRender && _lastRenderTiles is not null && _lastRenderTribes is not null)
        {
            var result = _selectionSystem.Pick(
                screenPosition, GraphicsDevice.Viewport, _camera,
                _mapWidth, _mapHeight, _lastRenderTiles, _lastRenderTribes);
            if (result is { TribeId: >= 0 })
                _playableSimulation.SelectedTribeId = result.TribeId;
            else
                _playableSimulation.SelectedTribeId = -1;
            if (result is { TileId: >= 0 })
                _playableSimulation.SelectedTileId = result.TileId;
        }
        else
        {
            var result = _selectionSystem.Pick(screenPosition, GraphicsDevice.Viewport, _camera, _playableSimulation, _renderAdapter);
            if (result is { TribeId: >= 0 })
                _playableSimulation.SelectedTribeId = result.TribeId;
            else
                _playableSimulation.SelectedTribeId = -1;
            if (result is { TileId: >= 0 })
                _playableSimulation.SelectedTileId = result.TileId;
        }
    }

    private void UpdateWindowTitle(GameTime gameTime)
    {
        _titleAccumulator += gameTime.ElapsedGameTime.TotalSeconds;
        if (_titleAccumulator < 0.25)
        {
            return;
        }

        _titleAccumulator = 0;

        // M6: In network mode, show ViewModel data in the title bar
        if (_isNetworkMode && _viewModel.HasV1Data)
        {
            var livingTribes = _viewModel.V1Tribes.Count(kv => kv.Value.IsAlive);
            var disputedTiles = _viewModel.TileData.Count(kv => kv.Value.IsDisputed);
            var tick = _viewModel.Tick;
            var endpoint = _diagnostics.IsConnected ? "node connected" : "node connecting...";

            Window.Title = $"Tribal NeuroSim | network | tick {tick} | tribes {livingTribes} | disputes {disputedTiles} | {endpoint}";
            return;
        }

        var selected = _playableSimulation.Tribes.FirstOrDefault(tribe => tribe.Id == _playableSimulation.SelectedTribeId);
        var localDisputedTiles = _playableSimulation.Tiles.Count(tile => tile.IsDisputed);
        var localLivingTribes = _playableSimulation.Tribes.Count(tribe => tribe.IsAlive);
        var selectedSummary = selected is null
            ? "none"
            : $"{selected.Name} pop {selected.Population} food {selected.FoodStores:0}";
        var mode = _playableSimulation.IsPaused ? "paused" : $"{_ticksPerSecond} tps";
        var localEndpoint = _diagnostics.IsConnected ? "node connected" : "local demo";

        Window.Title = $"Tribal NeuroSim | {mode} | tick {_playableSimulation.Tick} | tribes {localLivingTribes} | disputes {localDisputedTiles} | selected {selectedSummary} | {localEndpoint}";
    }

    private void LoadRuntimeTextures()
    {
        if (_runtimeAssets is null) return;

        foreach (var asset in RuntimeAssetCatalog.Terrain)
        {
            if (_runtimeAssets.LoadTexture(asset.Key) is { } texture)
                _terrainTextures[asset.Key] = texture;
        }
    }

    private void LoadVegetationModels()
    {
        if (_vegetationRenderer is null) return;

        var modelKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var profile in AssetManifest.BiomeProfiles)
        {
            foreach (var propKey in profile.PropAssetKeys)
                modelKeys.Add(propKey);
        }

        foreach (var profile in AssetManifest.PropProfiles)
            modelKeys.Add(profile.ModelKey);

        foreach (var key in modelKeys)
            _vegetationRenderer.LoadModel(key, key);
    }

    private void LoadSettlementModels()
    {
        if (_settlementRenderer is null) return;

        // Settlement FBX models (polity tier visuals)
        foreach (var asset in RuntimeAssetCatalog.SettlementModels)
            _settlementRenderer.LoadModel(asset.Key, asset.RelativePath);

        // Kenney Survival Kit models for tribal compound fallback
        var kenneyKeys = new[]
        {
            "Models/Structures/KenneySurvivalKit/tent",
            "Models/Structures/KenneySurvivalKit/tent-canvas",
            "Models/Structures/KenneySurvivalKit/structure",
            "Models/Structures/KenneySurvivalKit/fence",
            "Models/Structures/KenneySurvivalKit/campfire-pit",
            "Models/Structures/KenneySurvivalKit/resource-wood",
            "Models/Structures/KenneySurvivalKit/resource-stone",
            "Models/Structures/KenneySurvivalKit/workbench",
        };

        foreach (var key in kenneyKeys)
            _settlementRenderer.LoadModel(key, key);
    }

    private void ToggleIsolatedViewer()
    {
        _isolatedViewerEnabled = !_isolatedViewerEnabled;
        if (_isolatedViewerEnabled)
        {
            _isolatedModelIndex = 0;
            _camera.PauseInput = true;

            // Create a fixed camera looking at origin from a comfortable angle
            _isolatedCamera = new IsometricCamera
            {
                FocalPoint = Vector3.Zero,
                Distance = 30f,
                Pitch = MathHelper.ToRadians(25f),
                Yaw = MathHelper.ToRadians(45f),
            };
        }
        else
        {
            _camera.PauseInput = false;
            _isolatedCamera = null;
        }
    }

    private void ToggleFullscreen()
    {
        _graphics.ToggleFullScreen();
    }

    private void UpdatePanelBounds()
    {
        _panelBounds.Clear();

        if (_debugHud is not null)
        {
            AddPanelBounds(DraggablePanelId.DebugHud, _debugHud.LastBounds);
            AddPanelBounds(DraggablePanelId.Performance, _debugHud.LastPerformanceBounds);
        }

        if (_selectionPanel is not null)
            AddPanelBounds(DraggablePanelId.Selection, _selectionPanel.LastBounds);

        AddPanelBounds(DraggablePanelId.Lineage, _lineageInspector.LastBounds);
        AddPanelBounds(DraggablePanelId.Tombstone, _tombstonePanel.LastBounds);
        if (_obituaryVisible)
            AddPanelBounds(DraggablePanelId.Obituary, _obituaryPanel.LastBounds);
    }

    private void AddPanelBounds(DraggablePanelId panel, Rectangle bounds)
    {
        if (!bounds.IsEmpty)
            _panelBounds[panel] = bounds;
    }

    private void DrawIsolatedViewer(GameTime gameTime)
    {
        // Combine vegetation and settlement model keys for the isolated viewer
        var vegKeys = _vegetationRenderer?.LoadedModelKeys ?? Array.Empty<string>();
        var settlementKeys = _settlementRenderer?.LoadedModelKeys ?? Array.Empty<string>();
        var modelKeys = vegKeys.Concat(settlementKeys).ToArray();

        if (modelKeys.Length == 0)
        {
            _debugHud?.Draw(_spriteBatch!, new DebugHudState(
                ModeText: "ISOLATED VIEWER (no models loaded)",
                Tick: checked((long)Math.Min(_playableSimulation.Tick, long.MaxValue)),
                LivingTribes: 0,
                DisputedTiles: 0,
                SelectedName: null,
                SelectedPopulation: 0,
                SelectedFood: 0f,
                IsConnected: false,
                TicksPerSecond: 0,
                Paused: true,
                LastError: "No vegetation/settlement models registered"));
            return;
        }

        // Snap focal point to origin, let camera orbit with mouse
        _isolatedCamera!.FocalPoint = Vector3.Zero;
        _isolatedCamera.Update(gameTime, Keyboard.GetState(), Mouse.GetState(), _previousMouse, GraphicsDevice.Viewport);

        var modelKey = modelKeys[_isolatedModelIndex % modelKeys.Length];
        var isSettlement = modelKey.StartsWith("settlement/", StringComparison.OrdinalIgnoreCase);

        _vegetationRenderer!.RenderIsolatedModel(
            modelKey,
            GraphicsDevice,
            _isolatedCamera,
            scale: isSettlement ? 0.25f : 1f,
            rotationRadians: 0f,
            totalSeconds: (float)gameTime.TotalGameTime.TotalSeconds);

        _debugHud?.Draw(_spriteBatch!, new DebugHudState(
            ModeText: $"ISOLATED VIEWER [{_isolatedModelIndex + 1}/{modelKeys.Length}] {modelKey}",
            Tick: checked((long)Math.Min(_playableSimulation.Tick, long.MaxValue)),
            LivingTribes: 0,
            DisputedTiles: 0,
            SelectedName: modelKey,
            SelectedPopulation: 0,
            SelectedFood: 0f,
            IsConnected: false,
            TicksPerSecond: 0,
            Paused: true,
            LastError: "Arrow keys cycle models | F5 to exit isolated viewer"));
    }

    private void OnClientSizeChanged(object? sender, EventArgs e)
    {
        // Post-process RT and vignette must resize with the window
        if (_postProcessRenderer is not null && _graphics is not null)
        {
            var vp = _graphics.GraphicsDevice.Viewport;
            _postProcessRenderer.EnsureTargets(_graphics.GraphicsDevice, vp.Width, vp.Height);
        }
    }

    private static bool KeyPressedOnce(KeyboardState current, KeyboardState previous, Keys key)
    {
        return current.IsKeyDown(key) && !previous.IsKeyDown(key);
    }

    private void UpdateRenderMetrics(int terrainTiles, SettlementRenderStats settlementStats, int vegetationInstances)
    {
        _renderMetrics.Fps = _smoothedFps;
        _renderMetrics.TerrainTilesDrawn = terrainTiles;
        _renderMetrics.SettlementCloseCount = settlementStats.CloseCount;
        _renderMetrics.SettlementMidCount = settlementStats.MidCount;
        _renderMetrics.SettlementFarCulledCount = settlementStats.FarCulledCount;
        _renderMetrics.VegetationInstanceCount = vegetationInstances;
        _renderMetrics.EstimatedPrimitives = EstimatePrimitives(terrainTiles, settlementStats.TotalPrimitives, vegetationInstances);
        _renderMetrics.AssetLoadFailures = RenderMetrics.CalculateAssetLoadFailures(_diagnostics);
        _renderMetrics.FrameDecodeLatencyMs = _diagnostics.LastFrameReceivedAt is { } lastFrame
            ? (DateTimeOffset.UtcNow - lastFrame).TotalMilliseconds
            : -1;
        _renderMetrics.CameraDistance = _camera.Distance;
        _renderMetrics.ZoomLevelLabel = _camera.Distance > 500f ? "far" : _camera.Distance > 200f ? "mid" : "close";
        _renderMetrics.VSyncEnabled = GraphicsDevice.PresentationParameters.PresentationInterval != PresentInterval.Immediate;
    }

    private static int EstimatePrimitives(int terrainTiles, int settlementPrimitives, int vegetationInstances)
    {
        var terrainPrim = terrainTiles * HexTerrainMesh.TerrainPrimitivesPerTile;
        // Vegetation: ~150 triangles (50 primitives) avg per instance (trees ~200, grass ~20)
        var vegPrim = vegetationInstances * 50;
        return terrainPrim + settlementPrimitives + vegPrim;
    }

    private void LogNetworkRenderMetrics(GameTime gameTime)
    {
        if (!_isNetworkMode || !_viewModel.HasV1Data)
            return;

        _perfLogAccumulator += gameTime.ElapsedGameTime.TotalSeconds;
        if (_perfLogAccumulator < 2.0)
            return;
        _perfLogAccumulator = 0;

        Console.WriteLine(
            "[perf] " +
            $"tick={_viewModel.Tick} " +
            $"fps={_renderMetrics.Fps:0.0} " +
            $"cam={_renderMetrics.CameraDistance:0}({_renderMetrics.ZoomLevelLabel}) " +
            $"terrain={_renderMetrics.TerrainTilesDrawn}/{_viewModel.TileData.Count} " +
            $"terrainMode={_worldRenderer?.LastTerrainMode ?? "none"} " +
            $"settlements=C:{_renderMetrics.SettlementCloseCount} M:{_renderMetrics.SettlementMidCount} F:{_renderMetrics.SettlementFarCulledCount} " +
            $"vegetation={_renderMetrics.VegetationInstanceCount} " +
            $"wars={_viewModel.Wars.Count} " +
            $"tribes={_viewModel.V1Tribes.Count}");
    }

    private DebugHudState BuildHudState()
    {
        // M6: In network mode, show ViewModel data in the debug HUD
        if (_isNetworkMode && _viewModel.HasV1Data)
        {
            var v1Living = _viewModel.V1Tribes.Count(kv => kv.Value.IsAlive);
            var v1Disputed = _viewModel.TileData.Count(kv => kv.Value.IsDisputed);
            var v1PolityTiers = _viewModel.V1Tribes
                .Where(kv => kv.Value.IsAlive)
                .GroupBy(kv => kv.Value.PolityTier)
                .ToDictionary(g => g.Key, g => g.Count());
            var tierStr = string.Join(" ", new byte[] {0,1,2,3,4}
                .Select(t => $"{(t == 0 ? 'T' : t == 1 ? 'C' : t == 2 ? 'D' : t == 3 ? 'K' : 'E')}:{v1PolityTiers.GetValueOrDefault(t, 0)}"));
            var warCount = _viewModel.Wars.Count;
            var entityCount = (int)_viewModel.V1Tribes.Where(kv => kv.Value.IsAlive).Sum(kv => (long)kv.Value.EntityCount);

            TribeFrameV1Record? selectedV1Tribe = null;
            if (_playableSimulation.SelectedTribeId >= 0)
                _viewModel.V1Tribes.TryGetValue((uint)_playableSimulation.SelectedTribeId, out selectedV1Tribe);

            var selectedTierLabel = selectedV1Tribe is not null ? GetTierLabel(selectedV1Tribe.PolityTier) : null;
            var selectedNameStr = selectedV1Tribe is not null ? $"Tribe {selectedV1Tribe.Id} ({selectedTierLabel})" : null;

            return new DebugHudState(
                ModeText: _diagnostics.IsConnected ? "NETWORK" : "NETWORK (connecting...)",
                Tick: checked((long)_viewModel.Tick),
                LivingTribes: v1Living,
                DisputedTiles: v1Disputed,
                SelectedName: selectedNameStr,
                SelectedPopulation: selectedV1Tribe is not null ? (int)selectedV1Tribe.Population : 0,
                SelectedFood: selectedV1Tribe?.FoodStores ?? 0f,
                IsConnected: _diagnostics.IsConnected,
                TicksPerSecond: _ticksPerSecond,
                Paused: _networkPaused,
                LastError: _diagnostics.LastDecodeError ?? _diagnostics.LastConnectionError,
                Fps: _renderMetrics.Fps,
                TerrainTiles: _renderMetrics.TerrainTilesDrawn,
                SettlementClose: _renderMetrics.SettlementCloseCount,
                SettlementMid: _renderMetrics.SettlementMidCount,
                SettlementFarCulled: _renderMetrics.SettlementFarCulledCount,
                VegetationInstances: _renderMetrics.VegetationInstanceCount,
                EstimatedPrimitives: _renderMetrics.EstimatedPrimitives,
                AssetLoadFailures: _renderMetrics.AssetLoadFailures,
                FrameDecodeLatencyMs: _renderMetrics.FrameDecodeLatencyMs,
                CameraDistance: _renderMetrics.CameraDistance,
                ZoomLevelLabel: _renderMetrics.ZoomLevelLabel,
                VSyncEnabled: _renderMetrics.VSyncEnabled,
                SelectedTerritoryCount: selectedV1Tribe is not null ? selectedV1Tribe.TerritoryCount : 0,
                ExpansionCooldownRemaining: 0,
                SelectedExpansionCost: 0f,
                SelectedOverextended: false,
                // M5: V3 fields display
                ProtocolVersion: _viewModel.ProtocolVersion,
                PolityTierCounts: tierStr,
                ActiveWarCount: warCount,
                TotalEntityCount: entityCount,
                TombstoneCount: 0, // not yet available from ViewModel
                LineageDepth: 0,
                AssetDiagSummary: _diagnostics.LastDecodeError is not null ? "decode err" : "ok",
                // E2: brain / fitness / migration for selected tribe
                SelectedFitnessScore: selectedV1Tribe?.FitnessScore ?? 0f,
                SelectedIsMigrating: selectedV1Tribe?.IsMigrating ?? false,
                SelectedTopDrive: selectedV1Tribe is not null && selectedV1Tribe.NeuralOutputs.Length > 0
                    ? GetTopDriveLabel(selectedV1Tribe.NeuralOutputs)
                    : "");
        }

        var selected = _playableSimulation.Tribes.FirstOrDefault(tribe => tribe.Id == _playableSimulation.SelectedTribeId);
        var overextended = selected is { IsAlive: true }
            && selected.Territory.Count > 1 + selected.Population / 120;
        var cooldownRemaining = selected is { IsAlive: true }
            ? (long)selected.ExpansionCooldownTicks - (long)(_playableSimulation.Tick - selected.LastExpansionTick)
            : 0L;
        return new DebugHudState(
            ModeText: _diagnostics.IsConnected ? "NODE" : "LOCAL",
            Tick: checked((long)Math.Min(_playableSimulation.Tick, long.MaxValue)),
            LivingTribes: _playableSimulation.Tribes.Count(tribe => tribe.IsAlive),
            DisputedTiles: _playableSimulation.Tiles.Count(tile => tile.IsDisputed),
            SelectedName: selected?.Name,
            SelectedPopulation: selected?.Population ?? 0,
            SelectedFood: selected?.FoodStores ?? 0f,
            IsConnected: _diagnostics.IsConnected,
            TicksPerSecond: _ticksPerSecond,
            Paused: _playableSimulation.IsPaused,
            LastError: _diagnostics.LastDecodeError ?? _diagnostics.LastConnectionError,
            Fps: _renderMetrics.Fps,
            TerrainTiles: _renderMetrics.TerrainTilesDrawn,
            SettlementClose: _renderMetrics.SettlementCloseCount,
            SettlementMid: _renderMetrics.SettlementMidCount,
            SettlementFarCulled: _renderMetrics.SettlementFarCulledCount,
            VegetationInstances: _renderMetrics.VegetationInstanceCount,
            EstimatedPrimitives: _renderMetrics.EstimatedPrimitives,
            AssetLoadFailures: _renderMetrics.AssetLoadFailures,
            FrameDecodeLatencyMs: _renderMetrics.FrameDecodeLatencyMs,
            CameraDistance: _renderMetrics.CameraDistance,
            ZoomLevelLabel: _renderMetrics.ZoomLevelLabel,
            VSyncEnabled: _renderMetrics.VSyncEnabled,
            // R8: Expansion metrics
            SelectedTerritoryCount: selected?.Territory.Count ?? 0,
            ExpansionCooldownRemaining: Math.Max(0L, cooldownRemaining),
            SelectedExpansionCost: selected?.LastClaimCost ?? 0f,
            SelectedOverextended: overextended,
            // M5: V3 fields display
            ProtocolVersion: 0,
            PolityTierCounts: BuildPolityTierString(),
            ActiveWarCount: 0, // local demo has no war tracking
            TotalEntityCount: _playableSimulation.Tribes.Where(t => t.IsAlive).Sum(t => t.Population),
            TombstoneCount: _playableSimulation.Tombstones.Count,
            LineageDepth: 0, // entity-level lineage requires Rust backend
            AssetDiagSummary: _diagnostics.LastDecodeError is not null ? "decode err" : "ok",
            // M18B: Polity tier tracking
            HighestTierLabel: GetTierLabel((byte)_playableSimulation.HighestTierReached),
            MergeCount: _playableSimulation.ActiveMergeCount);
    }

    /// M5: Format polity tier counts for debug HUD (e.g. "T:10 C:2 D:0 K:1 E:0")
    private string BuildPolityTierString()
    {
        var tiers = _playableSimulation.Tribes
            .Where(t => t.IsAlive)
            .GroupBy(t => t.Tier)
            .ToDictionary(g => g.Key, g => g.Count());
        return string.Join(" ", new[] { PolityTier.Tribe, PolityTier.City, PolityTier.Duchy, PolityTier.Kingdom, PolityTier.Empire }
            .Select(t => $"{(char)t.ToString()[0]}:{tiers.GetValueOrDefault(t, 0)}"));
    }

    /// M6: Compact tier label for HUD line
    private static string GetTierLabel(byte tier) => tier switch
    {
        0 => "Tribe",
        1 => "City",
        2 => "Duchy",
        3 => "Kingdom",
        4 => "Empire",
        _ => $"?{tier}",
    };

    /// E2: Pick the highest neural output label for the HUD compact drive display.
    private static readonly string[] DriveLabels =
        ["Aggr", "Res", "Goal", "Migr", "Raid", "Isol", "Expn"];

    private static string GetTopDriveLabel(float[] outputs)
    {
        if (outputs.Length == 0) return "";
        var maxIdx = 0;
        for (var i = 1; i < Math.Min(outputs.Length, DriveLabels.Length); i++)
        {
            if (outputs[i] > outputs[maxIdx]) maxIdx = i;
        }
        return maxIdx < DriveLabels.Length ? DriveLabels[maxIdx] : "";
    }
}
