using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// 3D isometric-perspective camera inspired by Civilization 6.
/// The hex world lives on the XZ ground plane (Y = 0).
/// The camera orbits a focal point on the ground, pitched down at a configurable angle.
/// </summary>
public sealed class IsometricCamera
{
    // --- Orbital parameters ---

    /// <summary>Focal point on the ground plane that the camera looks at.</summary>
    public Vector3 FocalPoint { get; set; } = new Vector3(220f, 0f, 160f);

    /// <summary>Distance from the focal point to the camera eye.</summary>
    public float Distance { get; set; } = 400f;

    /// <summary>Rotation around the Y axis in radians (yaw / compass heading).</summary>
    public float Yaw { get; set; } = 0f;

    /// <summary>
    /// Pitch angle in radians, measured from the horizon.
    /// A value of ~0.61 rad (~35°) gives a classic Civ 6 isometric feel.
    /// </summary>
    public float Pitch { get; set; } = MathHelper.ToRadians(35f);

    // --- Limits ---
    public float MinDistance { get; set; } = 80f;
    public float MaxDistance { get; set; } = 1800f;
    public float MinPitch { get; set; } = MathHelper.ToRadians(15f);
    public float MaxPitch { get; set; } = MathHelper.ToRadians(75f);

    // --- Speeds ---
    public float PanSpeed { get; set; } = 600f;
    public float ZoomSpeed { get; set; } = 0.12f;
    public float RotationSpeed { get; set; } = 0.004f;

    // --- Perspective parameters ---
    public float FieldOfView { get; set; } = MathHelper.ToRadians(45f);
    public float NearPlane { get; set; } = 1f;
    public float FarPlane { get; set; } = 5000f;

    // --- Computed state ---
    private Matrix _view;
    private Matrix _projection;
    private Vector3 _eyePosition;

    /// <summary>The camera eye position in world space.</summary>
    public Vector3 EyePosition => _eyePosition;

    public void Update(
        GameTime gameTime,
        KeyboardState keyboard,
        MouseState mouse,
        MouseState previousMouse,
        Viewport viewport)
    {
        var elapsed = (float)gameTime.ElapsedGameTime.TotalSeconds;

        // --- WASD pan along the ground plane, oriented to current yaw ---
        var panDirection = Vector2.Zero;

        if (keyboard.IsKeyDown(Keys.W) || keyboard.IsKeyDown(Keys.Up))
            panDirection.Y -= 1f;
        if (keyboard.IsKeyDown(Keys.S) || keyboard.IsKeyDown(Keys.Down))
            panDirection.Y += 1f;
        if (keyboard.IsKeyDown(Keys.A) || keyboard.IsKeyDown(Keys.Left))
            panDirection.X -= 1f;
        if (keyboard.IsKeyDown(Keys.D) || keyboard.IsKeyDown(Keys.Right))
            panDirection.X += 1f;

        if (panDirection != Vector2.Zero)
        {
            panDirection.Normalize();
            // Pan speed scales with distance so it feels natural at all zoom levels
            var scaledSpeed = PanSpeed * (Distance / 400f) * elapsed;

            // Rotate the pan direction by current yaw so WASD aligns to the camera view
            var forward = new Vector3(MathF.Sin(Yaw), 0f, MathF.Cos(Yaw));
            var right = new Vector3(MathF.Cos(Yaw), 0f, -MathF.Sin(Yaw));

            FocalPoint += forward * (-panDirection.Y * scaledSpeed)
                        + right * (panDirection.X * scaledSpeed);
        }

        // --- Middle mouse drag: pan on ground plane ---
        if (mouse.MiddleButton == ButtonState.Pressed)
        {
            var dx = mouse.X - previousMouse.X;
            var dy = mouse.Y - previousMouse.Y;
            if (dx != 0 || dy != 0)
            {
                var scaledSpeed = Distance / 400f;
                var right = new Vector3(MathF.Cos(Yaw), 0f, -MathF.Sin(Yaw));
                var forward = new Vector3(MathF.Sin(Yaw), 0f, MathF.Cos(Yaw));

                FocalPoint += right * (-dx * scaledSpeed)
                            + forward * (dy * scaledSpeed);
            }
        }

        // --- Right mouse drag: orbit rotation (yaw + pitch) ---
        if (mouse.RightButton == ButtonState.Pressed)
        {
            var dx = mouse.X - previousMouse.X;
            var dy = mouse.Y - previousMouse.Y;
            if (dx != 0 || dy != 0)
            {
                Yaw -= dx * RotationSpeed;
                Pitch = MathHelper.Clamp(Pitch + dy * RotationSpeed, MinPitch, MaxPitch);
            }
        }

        // --- Scroll wheel: zoom (distance) ---
        var wheelDelta = mouse.ScrollWheelValue - previousMouse.ScrollWheelValue;
        if (wheelDelta != 0)
        {
            var zoomFactor = 1f - wheelDelta * ZoomSpeed * 0.01f;
            Distance = MathHelper.Clamp(Distance * zoomFactor, MinDistance, MaxDistance);
        }

        // --- Q/E: rotate yaw ---
        if (keyboard.IsKeyDown(Keys.Q))
        {
            Yaw += 1.5f * elapsed;
        }
        if (keyboard.IsKeyDown(Keys.E))
        {
            Yaw -= 1.5f * elapsed;
        }

        // Always recompute matrices (cheap enough, ensures first frame is correct)
        RecomputeMatrices(viewport);
    }

    /// <summary>Get the view matrix (world → camera).</summary>
    public Matrix GetView() => _view;

    /// <summary>Get the perspective projection matrix.</summary>
    public Matrix GetProjection() => _projection;

    /// <summary>
    /// Projects a world-space position to screen coordinates.
    /// Used for placing SpriteBatch overlays on top of 3D geometry.
    /// </summary>
    public Vector2 WorldToScreen(Vector3 worldPosition, Viewport viewport)
    {
        var projected = viewport.Project(worldPosition, _projection, _view, Matrix.Identity);
        return new Vector2(projected.X, projected.Y);
    }

    /// <summary>
    /// Converts a 2D hex center (which was in the old XY plane) into 3D world space on the XZ ground plane.
    /// The old hex layout used X as horizontal and Y as vertical on screen.
    /// In 3D, X stays horizontal, old-Y maps to Z (depth into screen), and Y = 0 (ground plane).
    /// </summary>
    public static Vector3 HexToWorld(Vector2 hexCenter)
    {
        return new Vector3(hexCenter.X, 0f, hexCenter.Y);
    }

    /// <summary>
    /// Unprojects a screen position to a ray, then intersects with the ground plane (Y=0)
    /// to get the world position under the cursor.
    /// </summary>
    public Vector3? ScreenToGround(Vector2 screenPosition, Viewport viewport)
    {
        var nearPoint = viewport.Unproject(
            new Vector3(screenPosition, 0f), _projection, _view, Matrix.Identity);
        var farPoint = viewport.Unproject(
            new Vector3(screenPosition, 1f), _projection, _view, Matrix.Identity);

        var direction = Vector3.Normalize(farPoint - nearPoint);

        // Intersect with Y = 0 plane
        if (MathF.Abs(direction.Y) < 1e-6f)
            return null; // Ray is parallel to ground

        var t = -nearPoint.Y / direction.Y;
        if (t < 0f)
            return null; // Ground is behind the camera

        return nearPoint + direction * t;
    }

    /// <summary>
    /// Convenience: project old 2D hex center to screen position for SpriteBatch overlay rendering.
    /// </summary>
    public Vector2 HexToScreen(Vector2 hexCenter, Viewport viewport)
    {
        return WorldToScreen(HexToWorld(hexCenter), viewport);
    }

    /// <summary>
    /// Backwards compatibility: converts screen position to old-style 2D world coordinates.
    /// Used by tribe selection logic.
    /// </summary>
    public Vector2 ScreenToWorld2D(Vector2 screenPosition, Viewport viewport)
    {
        var ground = ScreenToGround(screenPosition, viewport);
        if (ground is null)
            return Vector2.Zero;
        // Convert back: 3D (X, 0, Z) → 2D (X, Z)
        return new Vector2(ground.Value.X, ground.Value.Z);
    }

    private void RecomputeMatrices(Viewport viewport)
    {
        // Compute eye position from spherical coordinates around focal point
        _eyePosition = FocalPoint + new Vector3(
            -MathF.Sin(Yaw) * MathF.Cos(Pitch) * Distance,
            MathF.Sin(Pitch) * Distance,
            -MathF.Cos(Yaw) * MathF.Cos(Pitch) * Distance);

        _view = Matrix.CreateLookAt(_eyePosition, FocalPoint, Vector3.Up);

        var aspectRatio = viewport.Width / (float)Math.Max(1, viewport.Height);
        _projection = Matrix.CreatePerspectiveFieldOfView(
            FieldOfView, aspectRatio, NearPlane, FarPlane);
    }
}
