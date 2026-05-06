using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;

namespace TribalNeuroSim.Client.Rendering;

public enum ZoomLevel
{
    /// <summary>Empire view: colored territory, banners, polity names only. Distance > 500.</summary>
    Far,
    /// <summary>Regional view: settlements, borders, resource nodes. Distance 200-500.</summary>
    Mid,
    /// <summary>Tactical view: individual citizens, camp details, frontlines. Distance < 200.</summary>
    Close,
}

/// <summary>
/// 3D isometric-perspective camera inspired by Civilization 6.
/// The hex world lives on the XZ ground plane (Y = 0).
/// The camera orbits a focal point on the ground, pitched down at a configurable angle.
/// </summary>
public sealed class IsometricCamera
{
    // --- Orbital parameters ---

    public Vector3 FocalPoint { get; set; } = new Vector3(220f, 0f, 160f);

    public float Distance { get; set; } = 400f;

    public float Yaw { get; set; } = 0f;

    public float Pitch { get; set; } = MathHelper.ToRadians(35f);

    // --- Limits ---
    public float MinDistance { get; set; } = 80f;
    public float MaxDistance { get; set; } = 1800f;
    public float MinPitch { get; set; } = MathHelper.ToRadians(15f);
    public float MaxPitch { get; set; } = MathHelper.ToRadians(80f);

    // --- Speeds ---
    public float PanSpeed { get; set; } = 600f;
    public float ZoomSpeed { get; set; } = 0.12f;
    public float RotationSpeed { get; set; } = 0.004f;

    // --- Perspective parameters ---
    public float FieldOfView { get; set; } = MathHelper.ToRadians(45f);
    public float NearPlane { get; set; } = 1f;
    public float FarPlane { get; set; } = 5000f;

    // --- Map bounds ---
    private bool _hasMapBounds;
    private float _mapBoundsMinX;
    private float _mapBoundsMinZ;
    private float _mapBoundsMaxX;
    private float _mapBoundsMaxZ;

    // --- Zoom damping ---
    private float _targetDistance;
    private bool _targetDistanceSet;

    // --- Computed state ---
    private Matrix _view;
    private Matrix _projection;
    private Vector3 _eyePosition;

    public Vector3 EyePosition => _eyePosition;

    public bool PauseInput { get; set; }

    public ZoomLevel CurrentZoom
    {
        get
        {
            if (Distance > 500f) return ZoomLevel.Far;
            if (Distance > 200f) return ZoomLevel.Mid;
            return ZoomLevel.Close;
        }
    }

    private float TargetPitchForDistance(float distance)
    {
        float pitchAtMin = MathHelper.ToRadians(40f);
        float pitchAtMax = MathHelper.ToRadians(78f);

        var t = (distance - MinDistance) / (MaxDistance - MinDistance);
        return MathHelper.Lerp(pitchAtMin, pitchAtMax, MathHelper.Clamp(t, 0f, 1f));
    }

    public void SetMapBounds(float minX, float minZ, float maxX, float maxZ)
    {
        _hasMapBounds = true;
        _mapBoundsMinX = minX;
        _mapBoundsMinZ = minZ;
        _mapBoundsMaxX = maxX;
        _mapBoundsMaxZ = maxZ;
    }

    private void ClampFocalPoint()
    {
        if (!_hasMapBounds) return;

        // Tight padding so player sees table/parchment edge, not void.
        // Tabletop renderer covers the area outside bounds.
        var margin = MathHelper.Lerp(20f, 60f, (Distance - MinDistance) / (MaxDistance - MinDistance));

        FocalPoint = new Vector3(
            MathHelper.Clamp(FocalPoint.X, _mapBoundsMinX - margin, _mapBoundsMaxX + margin),
            FocalPoint.Y,
            MathHelper.Clamp(FocalPoint.Z, _mapBoundsMinZ - margin, _mapBoundsMaxZ + margin));
    }

    public void Update(
        GameTime gameTime,
        KeyboardState keyboard,
        MouseState mouse,
        MouseState previousMouse,
        Viewport viewport)
    {
        var elapsed = (float)gameTime.ElapsedGameTime.TotalSeconds;

        if (!_targetDistanceSet)
        {
            _targetDistance = Distance;
            _targetDistanceSet = true;
        }

        if (!PauseInput)
        {
            // --- WASD pan along ground plane, oriented to current yaw ---
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
                var scaledSpeed = PanSpeed * (Distance / 400f) * elapsed;

                // Yaw-relative directions on the XZ ground plane.
                // forward = where the camera looks (into screen, +Z when Yaw=0).
                // right   = screen-right (+X when Yaw=0).
                var forward = new Vector3(MathF.Sin(Yaw), 0f, MathF.Cos(Yaw));
                var right = new Vector3(MathF.Cos(Yaw), 0f, -MathF.Sin(Yaw));

                // panDirection.X > 0 = D/Right key → move focal toward screen-right (+X at Yaw=0).
                // panDirection.Y < 0 = W/Up key    → move focal toward screen-top (+Z at Yaw=0).
                FocalPoint += right * (panDirection.X * scaledSpeed)
                            + forward * (-panDirection.Y * scaledSpeed);
            }

            // --- Middle mouse drag: pan on ground plane (grab-and-drag) ---
            if (mouse.MiddleButton == ButtonState.Pressed)
            {
                var dx = mouse.X - previousMouse.X;
                var dy = mouse.Y - previousMouse.Y;
                if (dx != 0 || dy != 0)
                {
                    var scaledSpeed = Distance / 400f;
                    var right = new Vector3(MathF.Cos(Yaw), 0f, -MathF.Sin(Yaw));
                    var forward = new Vector3(MathF.Sin(Yaw), 0f, MathF.Cos(Yaw));

                    // Drag right → view moves right → focal shifts left (-X)
                    // Drag down  → view moves down → focal shifts toward camera (-Z at Yaw=0)
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
                    _targetDistance = Distance;
                }
            }

            // --- M4: Scroll wheel zoom — cursor-directed with pitch-shifting ---
            var wheelDelta = mouse.ScrollWheelValue - previousMouse.ScrollWheelValue;
            if (wheelDelta != 0)
            {
                var cursorScreen = new Vector2(mouse.X, mouse.Y);
                var groundBefore = ScreenToGround(cursorScreen, viewport);

                var zoomFactor = 1f - wheelDelta * ZoomSpeed * 0.01f;
                _targetDistance = MathHelper.Clamp(_targetDistance * zoomFactor, MinDistance, MaxDistance);

                // Shift focal toward/away from cursor ground point to keep terrain stable.
                // No temporary state swap needed — avoids one-frame camera jumps.
                if (groundBefore is { } groundPt)
                {
                    var toCursor = groundPt - FocalPoint;
                    // Zoom in (zoomFactor<1): pull focal toward cursor
                    // Zoom out (zoomFactor>1): push focal away
                    FocalPoint += toCursor * (1f - zoomFactor) * 0.65f;
                }
            }

            // --- Q/E: rotate yaw ---
            if (keyboard.IsKeyDown(Keys.Q))
                Yaw += 1.5f * elapsed;
            if (keyboard.IsKeyDown(Keys.E))
                Yaw -= 1.5f * elapsed;
        }

        // --- M4: Zoom damping ---
        const float dampingSharpness = 8f;
        Distance = MathHelper.Lerp(Distance, _targetDistance, MathHelper.Clamp(dampingSharpness * elapsed, 0f, 1f));

        // --- M4: Pitch-shifting ---
        var targetPitch = TargetPitchForDistance(Distance);
        const float pitchLerpSpeed = 6f;
        Pitch = MathHelper.Lerp(Pitch, targetPitch, MathHelper.Clamp(pitchLerpSpeed * elapsed, 0f, 1f));

        // --- Clamp focal point ---
        ClampFocalPoint();

        RecomputeMatrices(viewport);
    }

    public Matrix GetView() => _view;

    public Matrix GetProjection() => _projection;

    public Vector2 WorldToScreen(Vector3 worldPosition, Viewport viewport)
    {
        var projected = viewport.Project(worldPosition, _projection, _view, Matrix.Identity);
        return new Vector2(projected.X, projected.Y);
    }

    public static Vector3 HexToWorld(Vector2 hexCenter)
    {
        return new Vector3(hexCenter.X, 0f, hexCenter.Y);
    }

    public Vector3? ScreenToGround(Vector2 screenPosition, Viewport viewport)
    {
        var nearPoint = viewport.Unproject(
            new Vector3(screenPosition, 0f), _projection, _view, Matrix.Identity);
        var farPoint = viewport.Unproject(
            new Vector3(screenPosition, 1f), _projection, _view, Matrix.Identity);

        var direction = Vector3.Normalize(farPoint - nearPoint);

        if (MathF.Abs(direction.Y) < 1e-6f)
            return null;

        var t = -nearPoint.Y / direction.Y;
        if (t < 0f)
            return null;

        return nearPoint + direction * t;
    }

    public Vector2 HexToScreen(Vector2 hexCenter, Viewport viewport)
    {
        return WorldToScreen(HexToWorld(hexCenter), viewport);
    }

    public Vector2 ScreenToWorld2D(Vector2 screenPosition, Viewport viewport)
    {
        var ground = ScreenToGround(screenPosition, viewport);
        if (ground is null)
            return Vector2.Zero;
        return new Vector2(ground.Value.X, ground.Value.Z);
    }

    private void RecomputeMatrices(Viewport viewport)
    {
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
