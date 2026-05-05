using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Input;

namespace TribalNeuroSim.Client.Rendering;

public sealed class CameraController
{
    private const float PanSpeedPixelsPerSecond = 700f;
    private const float ZoomStep = 0.0015f;

    public Vector2 Position { get; set; }

    public float Zoom { get; set; } = 1f;

    public float MinZoom { get; set; } = 0.25f;

    public float MaxZoom { get; set; } = 4f;

    public void Update(
        GameTime gameTime,
        KeyboardState keyboard,
        MouseState mouse,
        MouseState previousMouse)
    {
        var elapsed = (float)gameTime.ElapsedGameTime.TotalSeconds;
        var direction = Vector2.Zero;

        if (keyboard.IsKeyDown(Keys.W) || keyboard.IsKeyDown(Keys.Up))
        {
            direction.Y -= 1f;
        }

        if (keyboard.IsKeyDown(Keys.S) || keyboard.IsKeyDown(Keys.Down))
        {
            direction.Y += 1f;
        }

        if (keyboard.IsKeyDown(Keys.A) || keyboard.IsKeyDown(Keys.Left))
        {
            direction.X -= 1f;
        }

        if (keyboard.IsKeyDown(Keys.D) || keyboard.IsKeyDown(Keys.Right))
        {
            direction.X += 1f;
        }

        if (direction != Vector2.Zero)
        {
            direction.Normalize();
            Position += direction * PanSpeedPixelsPerSecond * elapsed / Zoom;
        }

        if (mouse.RightButton == ButtonState.Pressed || mouse.MiddleButton == ButtonState.Pressed)
        {
            var previousPosition = new Vector2(previousMouse.X, previousMouse.Y);
            var currentPosition = new Vector2(mouse.X, mouse.Y);
            Position -= (currentPosition - previousPosition) / Zoom;
        }

        var wheelDelta = mouse.ScrollWheelValue - previousMouse.ScrollWheelValue;
        if (wheelDelta != 0)
        {
            var cursorScreen = new Vector2(mouse.X, mouse.Y);
            var cursorWorldBeforeZoom = ScreenToWorld(cursorScreen);
            Zoom = MathHelper.Clamp(Zoom + wheelDelta * ZoomStep, MinZoom, MaxZoom);
            var cursorWorldAfterZoom = ScreenToWorld(cursorScreen);
            Position += cursorWorldBeforeZoom - cursorWorldAfterZoom;
        }
    }

    public Vector2 WorldToScreen(Vector2 world)
    {
        var transform = CreateTransformMatrix();
        Vector2.Transform(ref world, ref transform, out var screen);
        return screen;
    }

    public Vector2 ScreenToWorld(Vector2 screen)
    {
        var transform = CreateTransformMatrix();
        Matrix.Invert(ref transform, out var inverse);
        Vector2.Transform(ref screen, ref inverse, out var world);
        return world;
    }

    public Matrix CreateTransformMatrix()
    {
        return Matrix.CreateTranslation(new Vector3(-Position, 0f))
            * Matrix.CreateScale(Zoom, Zoom, 1f);
    }
}
