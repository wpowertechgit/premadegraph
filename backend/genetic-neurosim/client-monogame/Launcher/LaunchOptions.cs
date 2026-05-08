namespace TribalNeuroSim.Client.Launcher;

public sealed record LaunchOptions(
    Uri NodeWebSocketEndpoint,
    Uri NodeHttpEndpoint,
    string? SessionId,
    bool ConnectMode = false,
    int MapWidth = 0,
    int MapHeight = 0,
    bool IsEmpireStress = false,
    bool IsDisputeStress = false)
{
    public static LaunchOptions FromArgs(IReadOnlyList<string> args)
    {
        var endpoint = new Uri("ws://127.0.0.1:3001/api/neurosim/desktop/v1/frames");
        var httpEndpoint = new Uri("http://127.0.0.1:3001/api/neurosim/desktop/v1");
        string? sessionId = null;
        var connectMode = false;
        var mapWidth = 0;
        var mapHeight = 0;
        var isEmpireStress = false;
        var isDisputeStress = false;

        foreach (var arg in args)
        {
            if (TryReadOption(arg, "--node-ws=", out var nodeWs) &&
                Uri.TryCreate(nodeWs, UriKind.Absolute, out var parsedEndpoint))
            {
                endpoint = parsedEndpoint;
                connectMode = true;
                continue;
            }

            if (TryReadOption(arg, "--node-http=", out var nodeHttp) &&
                Uri.TryCreate(nodeHttp, UriKind.Absolute, out var parsedHttpEndpoint))
            {
                httpEndpoint = parsedHttpEndpoint;
                connectMode = true;
                continue;
            }

            if (TryReadOption(arg, "--connect", out _))
            {
                connectMode = true;
                continue;
            }

            if (TryReadOption(arg, "--session=", out var parsedSession))
            {
                sessionId = parsedSession;
                connectMode = true;
                continue;
            }

            if (TryReadOption(arg, "--map-width=", out var mw) &&
                int.TryParse(mw, out var parsedMw) && parsedMw > 0)
            {
                mapWidth = parsedMw;
                continue;
            }

            if (TryReadOption(arg, "--map-height=", out var mh) &&
                int.TryParse(mh, out var parsedMh) && parsedMh > 0)
            {
                mapHeight = parsedMh;
                continue;
            }

            if (TryReadOption(arg, "--empire-stress", out _))
            {
                isEmpireStress = true;
                continue;
            }

            if (TryReadOption(arg, "--dispute-stress", out _))
            {
                isDisputeStress = true;
                continue;
            }

            if (arg.StartsWith("neurosim:", StringComparison.OrdinalIgnoreCase))
            {
                var launchUri = new Uri(arg);
                endpoint = ReadUriQuery(launchUri, "nodeWs") is { } uriText &&
                    Uri.TryCreate(uriText, UriKind.Absolute, out var uri)
                        ? uri
                        : endpoint;
                httpEndpoint = ReadUriQuery(launchUri, "nodeHttp") is { } httpText &&
                    Uri.TryCreate(httpText, UriKind.Absolute, out var httpUri)
                        ? httpUri
                        : httpEndpoint;
                sessionId = ReadUriQuery(launchUri, "session") ?? sessionId;
                connectMode = true;
            }
        }

        return new LaunchOptions(endpoint, httpEndpoint, sessionId, connectMode, mapWidth, mapHeight, isEmpireStress, isDisputeStress);
    }

    private static bool TryReadOption(string arg, string prefix, out string value)
    {
        if (arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            value = arg[prefix.Length..];
            return true;
        }

        value = string.Empty;
        return false;
    }

    private static string? ReadUriQuery(Uri uri, string key)
    {
        var query = uri.Query.TrimStart('?');
        if (query.Length == 0)
        {
            return null;
        }

        foreach (var part in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var pieces = part.Split('=', 2);
            if (pieces.Length == 2 && pieces[0].Equals(key, StringComparison.OrdinalIgnoreCase))
            {
                return Uri.UnescapeDataString(pieces[1]);
            }
        }

        return null;
    }
}
