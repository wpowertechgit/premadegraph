using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Input;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Net;
using TribalNeuroSim.Client.Protocol;
using TribalNeuroSim.Client.Rendering;
using Microsoft.Xna.Framework.Input;

var tests = new (string Name, Action Body)[]
{
    ("fallback registry has explicit biome profiles", RegistryHasExplicitBiomeProfiles),
    ("asset diagnostics reports complete baseline coverage", DiagnosticsReportsCompleteBaselineCoverage),
    ("client diagnostics records connection state", ClientDiagnosticsRecordsConnectionState),
    ("frame receiver queues decoded frames and updates diagnostics", RunAsync(FrameReceiverQueuesDecodedFramesAndUpdatesDiagnostics)),
    ("frame receiver records decode errors without queueing bad frame", RunAsync(FrameReceiverRecordsDecodeErrorsWithoutQueueingBadFrame)),
    ("playable simulation initializes deterministic tribes and tiles", PlayableSimulationInitializesDeterministicTribesAndTiles),
    ("playable simulation step advances territory and disputes", PlayableSimulationStepAdvancesTerritoryAndDisputes),
    ("playable render adapter maps simulation to renderables", PlayableRenderAdapterMapsSimulationToRenderables),
    ("playable render adapter uses proper terrain material textures", PlayableRenderAdapterUsesProperTerrainMaterialTextures),
    ("playable render adapter uses pointy hex geometry", PlayableRenderAdapterUsesPointyHexGeometry),
    ("playable render adapter hides debug food dots", PlayableRenderAdapterHidesDebugFoodDots),
    ("keyboard command controller uses press once semantics", KeyboardCommandControllerUsesPressOnceSemantics),
    ("tile control view state caps and normalizes claims", TileControlViewStateCapsAndNormalizesClaims),
    ("playable simulation records bounded events", PlayableSimulationRecordsBoundedEvents),
};

var failures = 0;

foreach (var test in tests)
{
    try
    {
        test.Body();
        Console.WriteLine($"PASS {test.Name}");
    }
    catch (Exception ex)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {test.Name}: {ex.Message}");
    }
}

if (failures > 0)
{
    Environment.Exit(1);
}

static void RegistryHasExplicitBiomeProfiles()
{
    var registry = AssetRegistry.CreateWithFallbacks();

    foreach (BiomeId biome in Enum.GetValues<BiomeId>())
    {
        var profile = registry.ResolveBiome(biome);
        Assert(profile.Biome == biome, $"{biome} resolved to {profile.Biome}");
        Assert(!string.Equals(profile.DisplayName, "Unknown", StringComparison.OrdinalIgnoreCase) || biome == BiomeId.Unknown,
            $"{biome} resolved to Unknown display profile");
        Assert(profile.PropAssetKeys.Count > 0 || biome == BiomeId.Unknown,
            $"{biome} has no prop asset keys");
    }
}

static void DiagnosticsReportsCompleteBaselineCoverage()
{
    var registry = AssetRegistry.CreateWithFallbacks();
    var diagnostics = AssetDiagnostics.FromRegistry(registry);

    Assert(diagnostics.RegisteredBiomeCount == Enum.GetValues<BiomeId>().Length,
        $"expected every biome to be registered, got {diagnostics.RegisteredBiomeCount}");
    Assert(diagnostics.RegisteredSettlementCount >= Enum.GetValues<PolityTier>().Length,
        $"expected settlement fallbacks, got {diagnostics.RegisteredSettlementCount}");
    Assert(diagnostics.MissingBiomes.Count == 0,
        $"missing biomes: {string.Join(", ", diagnostics.MissingBiomes)}");
    Assert(diagnostics.MissingSettlementTiers.Count == 0,
        $"missing settlement tiers: {string.Join(", ", diagnostics.MissingSettlementTiers)}");
}

static void Assert(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}

static Action RunAsync(Func<Task> body)
{
    return () => body().GetAwaiter().GetResult();
}

static void ClientDiagnosticsRecordsConnectionState()
{
    var diagnostics = new ClientDiagnostics();
    var endpoint = new Uri("ws://127.0.0.1:3001/api/neurosim/desktop/v1/frames");

    diagnostics.RecordConnectionOpened(endpoint);

    Assert(diagnostics.IsConnected, "expected connected diagnostics state");
    Assert(diagnostics.Endpoint == endpoint, $"expected endpoint {endpoint}, got {diagnostics.Endpoint}");
    Assert(diagnostics.LastConnectionError is null, $"unexpected connection error {diagnostics.LastConnectionError}");

    diagnostics.RecordConnectionError(endpoint, new InvalidOperationException("connection refused"));

    Assert(!diagnostics.IsConnected, "expected disconnected diagnostics state");
    Assert(diagnostics.LastConnectionError?.Contains("connection refused", StringComparison.OrdinalIgnoreCase) == true,
        $"expected connection error, got {diagnostics.LastConnectionError ?? "<null>"}");
}

static async Task FrameReceiverQueuesDecodedFramesAndUpdatesDiagnostics()
{
    using var cts = new CancellationTokenSource();
    var payloads = new Queue<byte[]>([new byte[] { 1, 2, 3 }]);
    var diagnostics = new ClientDiagnostics();
    var receiver = new SimulationFrameReceiver(
        ReceiveOnceThenCancel(payloads, cts),
        bytes => new SimulationFrame(
            ProtocolVersion: 1,
            Tick: 42,
            Generation: 7,
            Tribes: Array.Empty<TribeFrameRecord>(),
            FoodDeltas: Array.Empty<FoodTileDelta>()),
        diagnostics);

    await receiver.RunAsync(cts.Token);

    Assert(receiver.TryDequeueFrame(out var frame), "expected a decoded frame to be queued");
    Assert(frame.Tick == 42, $"expected tick 42, got {frame.Tick}");
    Assert(diagnostics.DecodedFrameCount == 1, $"expected one decoded frame, got {diagnostics.DecodedFrameCount}");
    Assert(diagnostics.LastFrameBytes == 3, $"expected 3 bytes, got {diagnostics.LastFrameBytes}");
    Assert(diagnostics.LastFrameTick == 42, $"expected last tick 42, got {diagnostics.LastFrameTick}");
    Assert(diagnostics.LastDecodeError is null, $"unexpected decode error {diagnostics.LastDecodeError}");
}

static async Task FrameReceiverRecordsDecodeErrorsWithoutQueueingBadFrame()
{
    using var cts = new CancellationTokenSource();
    var payloads = new Queue<byte[]>([new byte[] { 9, 9 }]);
    var diagnostics = new ClientDiagnostics();
    var receiver = new SimulationFrameReceiver(
        ReceiveOnceThenCancel(payloads, cts),
        _ => throw new InvalidDataException("bad payload"),
        diagnostics);

    await receiver.RunAsync(cts.Token);

    Assert(!receiver.TryDequeueFrame(out _), "bad payload should not queue a frame");
    Assert(diagnostics.DecodedFrameCount == 0, $"expected zero decoded frames, got {diagnostics.DecodedFrameCount}");
    Assert(diagnostics.LastFrameBytes == 2, $"expected 2 bytes, got {diagnostics.LastFrameBytes}");
    Assert(diagnostics.LastDecodeError?.Contains("bad payload", StringComparison.OrdinalIgnoreCase) == true,
        $"expected decode error, got {diagnostics.LastDecodeError ?? "<null>"}");
}

static Func<CancellationToken, Task<byte[]>> ReceiveOnceThenCancel(
    Queue<byte[]> payloads,
    CancellationTokenSource cancellation)
{
    return token =>
    {
        if (payloads.Count > 0)
        {
            return Task.FromResult(payloads.Dequeue());
        }

        cancellation.Cancel();
        throw new OperationCanceledException(token);
    };
}

static void PlayableSimulationInitializesDeterministicTribesAndTiles()
{
    var simulation = PlayableSimulation.CreateDemo(seed: 1337, width: 16, height: 12, tribeCount: 6);

    Assert(simulation.Tick == 0, $"expected tick 0, got {simulation.Tick}");
    Assert(simulation.Tiles.Count == 16 * 12, $"unexpected tile count {simulation.Tiles.Count}");
    Assert(simulation.Tribes.Count == 6, $"unexpected tribe count {simulation.Tribes.Count}");
    Assert(simulation.Tribes.All(tribe => tribe.IsAlive), "expected all initial tribes to be alive");
    Assert(simulation.Tribes.All(tribe => tribe.MainCampTileId >= 0), "expected every tribe to have a main camp");
    Assert(simulation.Tiles.Select(tile => tile.Biome).Distinct().Count() >= 5, "expected biome variety");
}

static void PlayableSimulationStepAdvancesTerritoryAndDisputes()
{
    var simulation = PlayableSimulation.CreateDemo(seed: 7, width: 10, height: 10, tribeCount: 4);

    for (var i = 0; i < 40; i++)
    {
        simulation.Step();
    }

    Assert(simulation.Tick == 40, $"expected tick 40, got {simulation.Tick}");
    Assert(simulation.Tribes.Any(tribe => tribe.Territory.Count > 1), "expected at least one tribe to expand");
    Assert(simulation.Tiles.Any(tile => tile.Controls.Count > 1 || tile.IsDisputed), "expected at least one disputed tile");
    Assert(simulation.Tribes.Sum(tribe => tribe.Population) > 0, "expected living population after short run");
}

static void PlayableRenderAdapterMapsSimulationToRenderables()
{
    var simulation = PlayableSimulation.CreateDemo(seed: 11, width: 8, height: 6, tribeCount: 3);
    simulation.Step();

    var adapter = new PlayableRenderAdapter(tileSize: 30f);
    var tiles = adapter.BuildTiles(simulation).ToArray();
    var tribes = adapter.BuildTribes(simulation).ToArray();

    Assert(tiles.Length == simulation.Tiles.Count, $"expected {simulation.Tiles.Count} tiles, got {tiles.Length}");
    Assert(tribes.Length == simulation.Tribes.Count, $"expected {simulation.Tribes.Count} tribes, got {tribes.Length}");
    Assert(tiles.All(tile => tile.Size == 30f), "expected tile size to be preserved");
    Assert(tribes.All(tribe => tribe.Radius > 0f), "expected positive tribe radii");
    Assert(tribes.Any(tribe => tribe.HasCamp), "expected camp markers");
}

static void PlayableRenderAdapterUsesProperTerrainMaterialTextures()
{
    var simulation = PlayableSimulation.CreateDemo(seed: 23, width: 14, height: 10, tribeCount: 4);
    var adapter = new PlayableRenderAdapter(tileSize: 30f);
    var textureKeys = adapter.BuildTiles(simulation)
        .Select(tile => tile.TextureKey)
        .Where(key => key is not null)
        .Cast<string>()
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    Assert(textureKeys.Length >= 4, $"expected varied terrain material keys, got {textureKeys.Length}");
    Assert(textureKeys.All(key => RuntimeAssetCatalog.AssetsByKey[key].RelativePath.StartsWith("Materials/Terrain/", StringComparison.OrdinalIgnoreCase)),
        $"expected terrain materials only, got {string.Join(", ", textureKeys)}");
}

static void PlayableRenderAdapterUsesPointyHexGeometry()
{
    var radius = 32f;
    var adapter = new PlayableRenderAdapter(tileSize: radius);
    var origin = adapter.TileCenter(0, 0);
    var east = adapter.TileCenter(1, 0);
    var south = adapter.TileCenter(0, 1);

    var expectedHorizontal = MathF.Sqrt(3f) * radius;
    var expectedVertical = 1.5f * radius;
    var expectedOddRowOffset = expectedHorizontal * 0.5f;

    Assert(Math.Abs((east.X - origin.X) - expectedHorizontal) < 0.001f,
        $"expected hex horizontal spacing {expectedHorizontal}, got {east.X - origin.X}");
    Assert(Math.Abs((south.Y - origin.Y) - expectedVertical) < 0.001f,
        $"expected hex vertical spacing {expectedVertical}, got {south.Y - origin.Y}");
    Assert(Math.Abs((south.X - origin.X) - expectedOddRowOffset) < 0.001f,
        $"expected odd row offset {expectedOddRowOffset}, got {south.X - origin.X}");
}

static void PlayableRenderAdapterHidesDebugFoodDots()
{
    var simulation = PlayableSimulation.CreateDemo(seed: 31, width: 8, height: 6, tribeCount: 3);
    var adapter = new PlayableRenderAdapter(tileSize: 30f);

    Assert(adapter.BuildTiles(simulation).All(tile => tile.FoodAmount == 0f),
        "food amounts should not render as debug dots on the map");
}

static void KeyboardCommandControllerUsesPressOnceSemantics()
{
    var controller = new KeyboardCommandController();
    var current = new KeyboardState(Keys.Space, Keys.N);
    var previous = new KeyboardState(Keys.Space);
    var mouse = new MouseState(12, 34, 0, ButtonState.Pressed, ButtonState.Released, ButtonState.Released, ButtonState.Released, ButtonState.Released);
    var previousMouse = new MouseState(12, 34, 0, ButtonState.Released, ButtonState.Released, ButtonState.Released, ButtonState.Released, ButtonState.Released);

    var commands = controller.ReadCommands(current, previous, mouse, previousMouse);

    Assert(!commands.TogglePause, "space was held and should not toggle again");
    Assert(commands.StepTick, "N was newly pressed and should step");
    Assert(commands.SelectAtScreenPosition, "left click should select");
    Assert(commands.SelectionScreenPosition == new Microsoft.Xna.Framework.Vector2(12, 34), "selection position should be captured");
}

static void TileControlViewStateCapsAndNormalizesClaims()
{
    var state = TileControlViewState.FromClaims(
        tileId: 8,
        efficiencyMultiplier: 0.60f,
        claims:
        [
            new TileControlClaimView(1, 1, 10f),
            new TileControlClaimView(2, 2, 7f),
            new TileControlClaimView(3, 3, 4f),
            new TileControlClaimView(4, 4, 3f),
            new TileControlClaimView(5, 5, 1f),
        ]);

    Assert(state.Claims.Count == TileControlViewState.MaxClaims, $"expected capped claims, got {state.Claims.Count}");
    Assert(Math.Abs(state.Claims.Sum(claim => claim.ControlShare) - 1f) < 0.0001f, "claims should normalize to one");
    Assert(state.IsDisputed, "multiple claims should be disputed");
    Assert(state.DominantOwnerId == 1, $"expected dominant owner 1, got {state.DominantOwnerId}");
}

static void PlayableSimulationRecordsBoundedEvents()
{
    var simulation = PlayableSimulation.CreateDemo(seed: 19, width: 12, height: 12, tribeCount: 8);

    for (var i = 0; i < 180; i++)
    {
        simulation.Step();
    }

    Assert(simulation.RecentEvents.Count <= 80, $"events should be bounded, got {simulation.RecentEvents.Count}");
    Assert(simulation.RecentEvents.Any(), "expected event trail after a run");
    Assert(simulation.RecentEvents.Any(evt => evt.Kind is PlayableEventKind.Expansion or PlayableEventKind.DisputedTileCreated or PlayableEventKind.Merger),
        "expected meaningful territory or merger events");
}
