using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Single source of truth for directional light vectors and colors shared by all renderers.
/// Terrain and settlement passes use the same sun angle so models look grounded.
/// </summary>
public static class SceneLighting
{
    // Ambient — scene base fill that prevents pure-black shadows
    public static readonly Vector3 AmbientColor = new(0.45f, 0.45f, 0.42f);

    // Base diffuse multiplier applied before directional lights
    public static readonly Vector3 DiffuseColor = new(1.0f, 1.0f, 0.98f);

    // Warm key light (sun) — primary direction and color
    public static readonly Vector3 KeyDirection = Vector3.Normalize(new Vector3(0.5f, -1f, -0.3f));
    public static readonly Vector3 KeyDiffuse = new(0.85f, 0.82f, 0.70f);

    // Cool fill light — opposite side, reduces flatness
    public static readonly Vector3 FillDirection = Vector3.Normalize(new Vector3(-0.3f, -0.6f, 0.5f));
    public static readonly Vector3 FillDiffuse = new(0.25f, 0.28f, 0.35f);

    /// <summary>Apply the shared two-light setup to a BasicEffect.</summary>
    public static void ApplyTo(BasicEffect effect)
    {
        effect.AmbientLightColor = AmbientColor;
        effect.DiffuseColor = DiffuseColor;
        effect.DirectionalLight0.Enabled = true;
        effect.DirectionalLight0.Direction = KeyDirection;
        effect.DirectionalLight0.DiffuseColor = KeyDiffuse;
        effect.DirectionalLight1.Enabled = true;
        effect.DirectionalLight1.Direction = FillDirection;
        effect.DirectionalLight1.DiffuseColor = FillDiffuse;
        effect.DirectionalLight2.Enabled = false;
    }
}
