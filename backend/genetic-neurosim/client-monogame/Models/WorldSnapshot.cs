namespace TribalNeuroSim.Client.Models;

public sealed record WorldSnapshotDto(int Width, int Height, ulong Seed, List<TileSnapshotDto> Tiles);

public sealed record TileSnapshotDto(byte Biome, float Food, float MaxFood, float DefenseBonus, float DiseaseRate);
