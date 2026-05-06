using Microsoft.Xna.Framework;
using TribalNeuroSim.Client.Assets;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// GPU-friendly batched prop instances grouped by model key.
/// Each model key gets one batch with pre-transformed world matrices.
/// </summary>
public sealed class PropInstanceBatch
{
    private readonly Dictionary<string, List<PropDrawInstance>> _batches = new(StringComparer.OrdinalIgnoreCase);

    private const int MaxInstancesPerModel = 2000;

    public IReadOnlyDictionary<string, List<PropDrawInstance>> Batches => _batches;

    /// <summary>
    /// Build batches from planned prop instances. Groups by model key,
    /// applies per-model instance cap.
    /// </summary>
    public void Build(IReadOnlyList<PlannedPropInstance> instances, float cameraDistance)
    {
        _batches.Clear();

        foreach (var instance in instances)
        {
            // LOD visibility check
            if (!PropPlacementPlanner.IsFamilyVisibleAtDistance(instance.Family, cameraDistance))
                continue;

            if (!_batches.TryGetValue(instance.ModelKey, out var list))
            {
                list = new List<PropDrawInstance>();
                _batches[instance.ModelKey] = list;
            }

            if (list.Count >= MaxInstancesPerModel)
                continue;

            list.Add(new PropDrawInstance(instance.World, instance.WindPhase, instance.Family));
        }
    }

    /// <summary>
    /// Add a single prop instance to the batch. Used by fallback/legacy paths.
    /// </summary>
    public void Add(string modelKey, Matrix world, float windPhase, PropFamily family = PropFamily.GrassPatch)
    {
        if (!_batches.TryGetValue(modelKey, out var list))
        {
            list = new List<PropDrawInstance>();
            _batches[modelKey] = list;
        }

        if (list.Count < MaxInstancesPerModel)
            list.Add(new PropDrawInstance(world, windPhase, family));
    }

    public void Clear()
    {
        foreach (var list in _batches.Values)
            list.Clear();
        _batches.Clear();
    }

    public int TotalInstanceCount => _batches.Values.Sum(b => b.Count);
}

/// <summary>
/// Single prop draw instance with precomputed world matrix and animation phase.
/// </summary>
public readonly record struct PropDrawInstance(Matrix World, float WindPhase, PropFamily Family);
