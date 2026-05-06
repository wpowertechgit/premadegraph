using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Input;
using TribalNeuroSim.Client.Launcher;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Net;
using TribalNeuroSim.Client.Protocol;
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
    private CancellationTokenSource? _receiverCancellation;
    private SimulationFrameReceiver? _frameReceiver;
    private Task? _receiverTask;
    private SpriteBatch? _spriteBatch;
    private WorldRenderer? _worldRenderer;
    private VegetationRenderer? _vegetationRenderer;
    private DebugHud? _debugHud;
    private RuntimeAssetLoader? _runtimeAssets;
    private readonly Dictionary<string, Texture2D> _terrainTextures = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, RuntimeModel> _terrainModels = new(StringComparer.OrdinalIgnoreCase);
    private KeyboardState _previousKeyboard;
    private MouseState _previousMouse;
    private double _simulationAccumulator;
    private double _titleAccumulator;
    private int _ticksPerSecond = 12;

    public GameRoot(LaunchOptions launchOptions)
    {
        _launchOptions = launchOptions;
        _graphics = new GraphicsDeviceManager(this)
        {
            PreferredBackBufferWidth = 1600,
            PreferredBackBufferHeight = 900,
            SynchronizeWithVerticalRetrace = true,
        };

        IsMouseVisible = true;
        Window.Title = "Tribal NeuroSim v3";

        _connection = new SimulationConnection();
        _frameDecoder = new FrameDecoder();
        _viewModel = new SimulationViewModel();
        _assetRegistry = AssetRegistry.CreateWithFallbacks();
        _diagnostics = new ClientDiagnostics();
        _playableSimulation = PlayableSimulation.CreateDemo();
        _renderAdapter = new PlayableRenderAdapter();
        _commandController = new KeyboardCommandController();
        _camera = new IsometricCamera
        {
            FocalPoint = new Vector3(220f, 0f, 160f),
            Distance = 400f,
            Pitch = MathHelper.ToRadians(35f),
        };
    }

    protected override void Initialize()
    {
        _receiverCancellation = new CancellationTokenSource();
        _receiverTask = Task.Run(() => ConnectAndReceiveFramesAsync(_receiverCancellation.Token));

        base.Initialize();
    }

    protected override void LoadContent()
    {
        _spriteBatch = new SpriteBatch(GraphicsDevice);
        _worldRenderer = new WorldRenderer();
        _debugHud = new DebugHud();
        _runtimeAssets = new RuntimeAssetLoader(GraphicsDevice);
        _vegetationRenderer = new VegetationRenderer(GraphicsDevice);
        LoadRuntimeTextures();
        LoadRuntimeModels();
        LoadVegetationModels();
        base.LoadContent();
    }

    protected override void Update(GameTime gameTime)
    {
        var keyboard = Keyboard.GetState();
        var mouse = Mouse.GetState();
        var commands = _commandController.ReadCommands(keyboard, _previousKeyboard, mouse, _previousMouse);

        if (commands.QuitRequested)
        {
            Exit();
            return;
        }

        _camera.Update(gameTime, keyboard, mouse, _previousMouse, GraphicsDevice.Viewport);
        HandlePlayableInput(commands);
        UpdatePlayableSimulation(gameTime);
        DrainReceivedFrames();
        UpdateWindowTitle(gameTime);

        _previousKeyboard = keyboard;
        _previousMouse = mouse;
        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(new Color(18, 19, 17));

        if (_spriteBatch is not null && _worldRenderer is not null)
        {
            var tiles = _renderAdapter.BuildTiles(_playableSimulation).ToArray();
            var tribes = _renderAdapter.BuildTribes(_playableSimulation).ToArray();

            _vegetationRenderer?.CollectInstances(_playableSimulation, _assetRegistry);
            _vegetationRenderer?.Render(_camera, GraphicsDevice);

            _worldRenderer.DrawWorld(
                _spriteBatch,
                tiles,
                tribes,
                _camera,
                _playableSimulation.SelectedTribeId,
                _terrainTextures,
                _terrainModels);
            _debugHud?.Draw(_spriteBatch, BuildHudState());
        }

        base.Draw(gameTime);
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
            _worldRenderer?.Dispose();
            _vegetationRenderer?.Dispose();
            _debugHud?.Dispose();
            _runtimeAssets?.Dispose();
            _spriteBatch?.Dispose();
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
        try
        {
            await _connection.ConnectAsync(_launchOptions.NodeWebSocketEndpoint, cancellationToken)
                .ConfigureAwait(false);
            _diagnostics.RecordConnectionOpened(_launchOptions.NodeWebSocketEndpoint);

            _frameReceiver = new SimulationFrameReceiver(
                _connection.ReceiveBinaryFrameAsync,
                payload => _frameDecoder.Decode(payload),
                _diagnostics);

            await _frameReceiver.RunAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _diagnostics.RecordConnectionError(_launchOptions.NodeWebSocketEndpoint, ex);
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
        }
    }

    private void HandlePlayableInput(PlayableCommandSet commands)
    {
        if (commands.TogglePause)
        {
            _playableSimulation.IsPaused = !_playableSimulation.IsPaused;
        }

        if (commands.StepTick)
        {
            _playableSimulation.Step();
        }

        if (commands.Reset)
        {
            _playableSimulation.Reset();
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
            SelectTribeAtScreenPosition(screenPosition);
        }
    }

    private void UpdatePlayableSimulation(GameTime gameTime)
    {
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
            return;
        }

        var currentIndex = Array.FindIndex(living, tribe => tribe.Id == _playableSimulation.SelectedTribeId);
        _playableSimulation.SelectedTribeId = living[(currentIndex + 1 + living.Length) % living.Length].Id;
    }

    private void SelectTribeAtScreenPosition(Vector2 screenPosition)
    {
        var worldPosition = _camera.ScreenToWorld2D(screenPosition, GraphicsDevice.Viewport);
        var nearest = _renderAdapter.BuildTribes(_playableSimulation)
            .Select(tribe => new
            {
                Tribe = tribe,
                Distance = Vector2.Distance(tribe.Position, worldPosition),
            })
            .OrderBy(candidate => candidate.Distance)
            .FirstOrDefault();

        if (nearest is not null && nearest.Distance <= Math.Max(18f, nearest.Tribe.Radius * 1.8f))
        {
            _playableSimulation.SelectedTribeId = nearest.Tribe.Id;
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
        var selected = _playableSimulation.Tribes.FirstOrDefault(tribe => tribe.Id == _playableSimulation.SelectedTribeId);
        var disputedTiles = _playableSimulation.Tiles.Count(tile => tile.IsDisputed);
        var livingTribes = _playableSimulation.Tribes.Count(tribe => tribe.IsAlive);
        var selectedSummary = selected is null
            ? "none"
            : $"{selected.Name} pop {selected.Population} food {selected.FoodStores:0}";
        var mode = _playableSimulation.IsPaused ? "paused" : $"{_ticksPerSecond} tps";
        var endpoint = _diagnostics.IsConnected ? "node connected" : "local demo";

        Window.Title = $"Tribal NeuroSim v3 | {mode} | tick {_playableSimulation.Tick} | tribes {livingTribes} | disputes {disputedTiles} | selected {selectedSummary} | {endpoint}";
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

        // Collect unique prop keys from all biome profiles
        var modelKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var profile in AssetManifest.BiomeProfiles)
        {
            foreach (var propKey in profile.PropAssetKeys)
                modelKeys.Add(propKey);
        }

        // Also load structure models used by PlaceTent
        modelKeys.Add("Models/Structures/KenneySurvivalKit/tent");
        modelKeys.Add("Models/Structures/KenneySurvivalKit/campfire-pit");

        foreach (var key in modelKeys)
            _vegetationRenderer.LoadModel(key, key);
    }

    private void LoadRuntimeModels()
    {
        if (_runtimeAssets is null) return;

        foreach (var asset in RuntimeAssetCatalog.TerrainModels)
        {
            if (_runtimeAssets.LoadModel(asset.Key) is { } model)
                _terrainModels[asset.Key] = model;
        }
    }

    private DebugHudState BuildHudState()
    {
        var selected = _playableSimulation.Tribes.FirstOrDefault(tribe => tribe.Id == _playableSimulation.SelectedTribeId);
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
            LastError: _diagnostics.LastDecodeError ?? _diagnostics.LastConnectionError);
    }
}
