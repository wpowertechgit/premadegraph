using System.Text.Json.Serialization;

namespace TribalNeuroSim.Client.Models;

public sealed record TileControlClaimView(
    [property: JsonPropertyName("polity_id")] uint PolityId,
    [property: JsonPropertyName("tribe_id")] uint TribeId,
    [property: JsonPropertyName("control_share")] float ControlShare);

public sealed class TileControlViewState
{
    public const int MaxClaims = 4;

    public TileControlViewState(
        ushort tileId,
        bool isDisputed,
        float efficiencyMultiplier,
        IEnumerable<TileControlClaimView> claims)
    {
        TileId = tileId;
        IsDisputed = isDisputed;
        EfficiencyMultiplier = efficiencyMultiplier;
        Claims = NormalizeClaims(claims);
    }

    [JsonPropertyName("tile_id")]
    public ushort TileId { get; }

    [JsonPropertyName("is_disputed")]
    public bool IsDisputed { get; }

    [JsonPropertyName("efficiency_multiplier")]
    public float EfficiencyMultiplier { get; }

    [JsonPropertyName("claims")]
    public IReadOnlyList<TileControlClaimView> Claims { get; }

    [JsonIgnore]
    public uint? DominantOwnerId => Claims.Count == 0 ? null : Claims[0].TribeId;

    public static TileControlViewState FromClaims(
        ushort tileId,
        float efficiencyMultiplier,
        IEnumerable<TileControlClaimView> claims)
    {
        var normalizedClaims = NormalizeClaims(claims);
        return new TileControlViewState(
            tileId,
            normalizedClaims.Count > 1,
            efficiencyMultiplier,
            normalizedClaims);
    }

    public static IReadOnlyList<TileControlClaimView> NormalizeClaims(
        IEnumerable<TileControlClaimView> claims)
    {
        var cappedClaims = claims
            .Where(claim => claim.ControlShare > 0.0f)
            .OrderByDescending(claim => claim.ControlShare)
            .Take(MaxClaims)
            .ToArray();

        var totalShare = cappedClaims.Sum(claim => claim.ControlShare);
        if (totalShare <= 0.0f)
        {
            return Array.Empty<TileControlClaimView>();
        }

        return cappedClaims
            .Select(claim => claim with { ControlShare = claim.ControlShare / totalShare })
            .ToArray();
    }
}
