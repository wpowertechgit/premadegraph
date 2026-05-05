using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Launcher;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Net;
using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client;

public sealed class GameRoot : Game
{
    private readonly GraphicsDeviceManager _graphics;
    private readonly LaunchOptions _launchOptions;
    private readonly SimulationConnection _connection;
    private readonly FrameDecoder _frameDecoder;
    private readonly SimulationViewModel _viewModel;
    private readonly AssetRegistry _assetRegistry;

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
    }

    protected override void Initialize()
    {
        base.Initialize();
    }

    protected override void Update(GameTime gameTime)
    {
        if (Keyboard.GetState().IsKeyDown(Keys.Escape))
        {
            Exit();
            return;
        }

        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(Color.Black);
        base.Draw(gameTime);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _connection.DisposeAsync().AsTask().GetAwaiter().GetResult();
            _graphics.Dispose();
        }

        base.Dispose(disposing);
    }

    public LaunchOptions LaunchOptions => _launchOptions;

    public SimulationViewModel ViewModel => _viewModel;

    public AssetRegistry AssetRegistry => _assetRegistry;

    public FrameDecoder FrameDecoder => _frameDecoder;
}
