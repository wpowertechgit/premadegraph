using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TribalNeuroSim.Client.Assets;

public static class ContentBootstrapper
{
    public const string DefaultGoogleDriveFolderId = "1Br4l9Ctr4dMOgZV6h221rKhvDpp49S_f";

    private static readonly Lazy<IReadOnlyList<string>> DefaultRequiredRelativePaths = new(() =>
        RuntimeAssetCatalog.AssetsByKey.Values
            .Select(asset => asset.RelativePath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray());

    public static async Task<ContentBootstrapResult> EnsureContentAsync(
        ContentBootstrapOptions? options = null,
        IContentDownloader? downloader = null,
        CancellationToken cancellationToken = default)
    {
        options ??= new ContentBootstrapOptions();
        var contentRoot = ResolveTargetContentRoot(options.ContentRoot);
        var requiredRelativePaths = options.RequiredRelativePaths ?? DefaultRequiredRelativePaths.Value;

        if (HasRequiredContent(contentRoot, requiredRelativePaths))
        {
            return new ContentBootstrapResult(contentRoot, Downloaded: false);
        }

        Console.WriteLine($"[content] Missing runtime assets. Restoring Content from Google Drive folder {options.GoogleDriveFolderId}...");
        Directory.CreateDirectory(contentRoot);

        downloader ??= new GoogleDriveContentDownloader();
        await downloader.DownloadAsync(
            new ContentDownloadRequest(options.GoogleDriveFolderId, contentRoot),
            cancellationToken);

        if (!HasRequiredContent(contentRoot, requiredRelativePaths))
        {
            throw new InvalidOperationException(
                "Content download finished, but required runtime assets are still missing. " +
                $"Check the Google Drive folder contents and target path: {contentRoot}");
        }

        Console.WriteLine($"[content] Runtime assets restored to {contentRoot}");
        return new ContentBootstrapResult(contentRoot, Downloaded: true);
    }

    public static bool HasRequiredContent(
        string contentRoot,
        IReadOnlyList<string>? requiredRelativePaths = null)
    {
        if (!Directory.Exists(contentRoot))
            return false;

        foreach (var relativePath in requiredRelativePaths ?? DefaultRequiredRelativePaths.Value)
        {
            var fullPath = Path.Combine(
                contentRoot,
                relativePath.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(fullPath))
                return false;
        }

        return true;
    }

    public static string ResolveTargetContentRoot(string? explicitContentRoot = null)
    {
        if (!string.IsNullOrWhiteSpace(explicitContentRoot))
            return Path.GetFullPath(explicitContentRoot);

        if (RuntimeAssetLoader.ResolveContentRoot() is { } existingContentRoot)
            return existingContentRoot;

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var projectFile = Path.Combine(current.FullName, "TribalNeuroSim.Client.csproj");
            if (File.Exists(projectFile))
                return Path.Combine(current.FullName, "Content");

            current = current.Parent;
        }

        return Path.Combine(AppContext.BaseDirectory, "Content");
    }
}

public sealed class ContentBootstrapOptions
{
    public ContentBootstrapOptions(
        string? contentRoot = null,
        string googleDriveFolderId = ContentBootstrapper.DefaultGoogleDriveFolderId,
        IReadOnlyList<string>? requiredRelativePaths = null)
    {
        ContentRoot = contentRoot;
        GoogleDriveFolderId = googleDriveFolderId;
        RequiredRelativePaths = requiredRelativePaths;
    }

    public string? ContentRoot { get; }

    public string GoogleDriveFolderId { get; }

    public IReadOnlyList<string>? RequiredRelativePaths { get; }
}

public sealed record ContentBootstrapResult(string ContentRoot, bool Downloaded);

public sealed record ContentDownloadRequest(string FolderId, string TargetContentRoot);

public interface IContentDownloader
{
    Task DownloadAsync(ContentDownloadRequest request, CancellationToken cancellationToken);
}

public sealed partial class GoogleDriveContentDownloader : IContentDownloader
{
    private static readonly Uri DriveBaseUri = new("https://drive.google.com/");
    private static readonly Uri TakeoutBaseUri = new("https://takeout-pa.clients6.google.com/");

    private readonly HttpClient _httpClient;
    private readonly TimeSpan _pollDelay;
    private readonly int _maxPollAttempts;

    public GoogleDriveContentDownloader(HttpClient? httpClient = null, TimeSpan? pollDelay = null, int maxPollAttempts = 120)
    {
        _httpClient = httpClient ?? new HttpClient();
        _pollDelay = pollDelay ?? TimeSpan.FromSeconds(5);
        _maxPollAttempts = maxPollAttempts;
    }

    public async Task DownloadAsync(ContentDownloadRequest request, CancellationToken cancellationToken)
    {
        var metadata = await LoadFolderMetadataAsync(request.FolderId, cancellationToken);
        var exportId = await StartExportAsync(request.FolderId, metadata.Title, metadata.ApiKey, cancellationToken);
        var archives = await WaitForArchivesAsync(exportId, metadata.ApiKey, cancellationToken);

        var stagingRoot = Path.Combine(
            Path.GetTempPath(),
            "neurosim-content-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(stagingRoot);

        try
        {
            foreach (var archive in archives)
            {
                Console.WriteLine($"[content] Downloading {archive.FileName} ({archive.CompressedSize} bytes)...");
                await DownloadAndExtractArchiveAsync(archive.StoragePath, stagingRoot, cancellationToken);
            }

            CopyExtractedContent(stagingRoot, request.TargetContentRoot);
        }
        finally
        {
            if (Directory.Exists(stagingRoot))
                Directory.Delete(stagingRoot, recursive: true);
        }
    }

    private async Task<DriveFolderMetadata> LoadFolderMetadataAsync(string folderId, CancellationToken cancellationToken)
    {
        var folderUri = new Uri(DriveBaseUri, $"drive/folders/{Uri.EscapeDataString(folderId)}");
        var html = await _httpClient.GetStringAsync(folderUri, cancellationToken);

        var keyMatch = GoogleDriveAnonymousKeyRegex().Match(html);
        if (!keyMatch.Success)
        {
            throw new InvalidOperationException(
                "Could not extract the anonymous Google Drive export key from the shared folder page. " +
                "Google may have changed its public folder download flow.");
        }

        var titleMatch = GoogleDriveTitleRegex().Match(html);
        var title = titleMatch.Success
            ? WebUtility.HtmlDecode(titleMatch.Groups["title"].Value).Trim()
            : "Content";

        return new DriveFolderMetadata(title, Regex.Unescape(keyMatch.Groups["key"].Value));
    }

    private async Task<string> StartExportAsync(
        string folderId,
        string title,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(new
        {
            archivePrefix = title,
            items = new[] { new { id = folderId } },
        });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var response = await _httpClient.PostAsync(
            new Uri(TakeoutBaseUri, $"v1/exports?key={Uri.EscapeDataString(apiKey)}"),
            content,
            cancellationToken);
        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return json.RootElement
            .GetProperty("exportJob")
            .GetProperty("id")
            .GetString()
            ?? throw new InvalidOperationException("Google Drive export response did not include an export job id.");
    }

    private async Task<IReadOnlyList<DriveArchive>> WaitForArchivesAsync(
        string exportId,
        string apiKey,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= _maxPollAttempts; attempt++)
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                new Uri(TakeoutBaseUri, $"v1/exports/{Uri.EscapeDataString(exportId)}?key={Uri.EscapeDataString(apiKey)}"));
            request.Headers.TryAddWithoutValidation("PbiToken", Guid.NewGuid().ToString("N"));

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var exportJob = json.RootElement.GetProperty("exportJob");
            var status = exportJob.TryGetProperty("status", out var statusElement)
                ? statusElement.GetString()
                : null;

            if (exportJob.TryGetProperty("archives", out var archivesElement) &&
                archivesElement.ValueKind == JsonValueKind.Array &&
                archivesElement.GetArrayLength() > 0)
            {
                return archivesElement.EnumerateArray()
                    .Select(archive => new DriveArchive(
                        archive.GetProperty("fileName").GetString() ?? "content.zip",
                        archive.GetProperty("storagePath").GetString() ?? throw new InvalidOperationException("Archive is missing storagePath."),
                        archive.TryGetProperty("compressedSize", out var size) && size.TryGetInt64(out var parsedSize)
                            ? parsedSize
                            : 0))
                    .ToArray();
            }

            if (string.Equals(status, "FAILED", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(status, "CANCELLED", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"Google Drive export failed with status {status}.");
            }

            Console.WriteLine($"[content] Google Drive export is {status ?? "pending"} ({attempt}/{_maxPollAttempts})...");
            await Task.Delay(_pollDelay, cancellationToken);
        }

        throw new TimeoutException("Timed out waiting for Google Drive to prepare the Content download.");
    }

    private async Task DownloadAndExtractArchiveAsync(
        string storagePath,
        string stagingRoot,
        CancellationToken cancellationToken)
    {
        var archiveUri = storagePath.StartsWith("http", StringComparison.OrdinalIgnoreCase)
            ? new Uri(storagePath)
            : new Uri("https://storage.googleapis.com/drive-bulk-export-anonymous/" + storagePath.TrimStart('/'));

        var tempArchivePath = Path.Combine(
            Path.GetTempPath(),
            "neurosim-content-archive-" + Guid.NewGuid().ToString("N") + ".zip");

        try
        {
            await using (var remoteStream = await _httpClient.GetStreamAsync(archiveUri, cancellationToken))
            await using (var fileStream = File.Create(tempArchivePath))
            {
                await remoteStream.CopyToAsync(fileStream, cancellationToken);
            }

            using var archive = ZipFile.OpenRead(tempArchivePath);
            var stagingRootWithSeparator = Path.TrimEndingDirectorySeparator(stagingRoot) + Path.DirectorySeparatorChar;
            foreach (var entry in archive.Entries)
            {
                if (string.IsNullOrEmpty(entry.Name))
                    continue;

                var destinationPath = Path.GetFullPath(Path.Combine(
                    stagingRoot,
                    entry.FullName.Replace('/', Path.DirectorySeparatorChar)));

                if (!destinationPath.StartsWith(stagingRootWithSeparator, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException($"Refusing to extract zip entry outside staging directory: {entry.FullName}");

                Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
                entry.ExtractToFile(destinationPath, overwrite: true);
            }
        }
        finally
        {
            if (File.Exists(tempArchivePath))
                File.Delete(tempArchivePath);
        }
    }

    private static void CopyExtractedContent(string stagingRoot, string targetContentRoot)
    {
        var sourceRoot = ResolveExtractedContentRoot(stagingRoot);
        Directory.CreateDirectory(targetContentRoot);

        foreach (var sourcePath in Directory.EnumerateFiles(sourceRoot, "*", SearchOption.AllDirectories))
        {
            var relativePath = Path.GetRelativePath(sourceRoot, sourcePath);
            var targetPath = Path.Combine(targetContentRoot, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
            File.Copy(sourcePath, targetPath, overwrite: true);
        }
    }

    private static string ResolveExtractedContentRoot(string stagingRoot)
    {
        var explicitContentRoot = Directory.EnumerateDirectories(stagingRoot, "Content", SearchOption.AllDirectories)
            .OrderBy(path => path.Length)
            .FirstOrDefault();
        if (explicitContentRoot is not null)
            return explicitContentRoot;

        var singleRoot = Directory.EnumerateDirectories(stagingRoot).Take(2).ToArray();
        return singleRoot.Length == 1 ? singleRoot[0] : stagingRoot;
    }

    [GeneratedRegex(@"""yLTeS"":""(?<key>[^""]+)""", RegexOptions.Compiled)]
    private static partial Regex GoogleDriveAnonymousKeyRegex();

    [GeneratedRegex(@"<title>(?<title>.*?)\s+-\s+Google Drive</title>", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex GoogleDriveTitleRegex();

    private sealed record DriveFolderMetadata(string Title, string ApiKey);

    private sealed record DriveArchive(string FileName, string StoragePath, long CompressedSize);
}
