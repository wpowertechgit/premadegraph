using System.Data;
using System.Net;
using System.Text.Json;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);
var appBasePath = NormalizeBasePath(Environment.GetEnvironmentVariable("DB_EXPLORER_PATH_BASE"));

var root = ResolveRepositoryRoot(builder.Environment.ContentRootPath);
var datasets = DatasetCatalog.Load(root);
var startupDataset = datasets.Current;
var projectDbPath = ResolveProjectDbPath(builder.Environment.ContentRootPath, startupDataset.Id);

if (args.Length > 0 && string.Equals(args[0], "import", StringComparison.OrdinalIgnoreCase))
{
    var requestedDataset = args.Length > 1 ? args[1] : startupDataset.Id;
    var dataset = datasets.Resolve(requestedDataset);
    var result = ProjectImporter.Import(root, ResolveProjectDbPath(builder.Environment.ContentRootPath, dataset.Id), dataset);
    PrintImportResult(result, ResolveProjectDbPath(builder.Environment.ContentRootPath, dataset.Id), dataset);
    return;
}

try
{
    var startupImport = ProjectImporter.Import(root, projectDbPath, startupDataset);
    Console.WriteLine("Indítás előtti automatikus import kész.");
    PrintImportResult(startupImport, projectDbPath, startupDataset);
}
catch (Exception exception)
{
    Console.WriteLine($"Automatikus import sikertelen: {exception.Message}");
    Console.WriteLine("A webes felület elindul, és jelzi, ha hiányzik a generált projektadatbázis.");
}

var app = builder.Build();
if (!string.IsNullOrWhiteSpace(appBasePath))
{
    app.UsePathBase(appBasePath);
}

app.MapGet("/", (HttpRequest request) => RenderBrowserResponse(builder.Environment.ContentRootPath, root, datasets, request));
app.MapGet("/database", (HttpRequest request) => RenderBrowserResponse(builder.Environment.ContentRootPath, root, datasets, request));
app.MapGet("/database/value", (HttpRequest request) =>
{
    var selectedDataset = datasets.Resolve(request.Query["dataset"].ToString());
    var database = new ProjectDatabase(ResolveProjectDbPath(builder.Environment.ContentRootPath, selectedDataset.Id), selectedDataset);
    EnsureDatasetImported(root, database);
    var value = database.LoadFullValue(request.Query);
    if (!value.IsReady)
    {
        return Results.Content(RenderShell("database", RenderMissingDatabase(value.DatabasePath), "Adatbázis böngésző"), "text/html; charset=utf-8");
    }

    return Results.Content(RenderFullValuePage(value, datasets.All), "text/html; charset=utf-8");
});

app.Run();

static string ResolveProjectDbPath(string contentRoot, string datasetId) =>
    Path.Combine(contentRoot, "Data", $"premadegraph_project_{SafeFilePart(datasetId)}.db");

static string SafeFilePart(string value)
{
    var safe = new string(value.Select(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '_').ToArray());
    return string.IsNullOrWhiteSpace(safe) ? "default" : safe;
}

static void PrintImportResult(ImportResult result, string projectDbPath, DatasetInfo dataset)
{
    Console.WriteLine("Import kész.");
    Console.WriteLine($"Dataset: {dataset.Id} - {dataset.Name}");
    Console.WriteLine($"Cél adatbázis: {projectDbPath}");
    Console.WriteLine($"Játékosok: {result.PlayerCount}");
    Console.WriteLine($"Klaszterek: {result.ClusterCount}");
    Console.WriteLine($"Klasztertagságok: {result.ClusterMemberCount}");
    Console.WriteLine($"Útkeresési mentések: {result.ReplayCount}");
    Console.WriteLine($"Útkeresési futások: {result.ReplayRunCount}");
}

IResult RenderBrowserResponse(string contentRoot, string repositoryRoot, DatasetCatalog datasets, HttpRequest request)
{
    var selectedDataset = datasets.Resolve(request.Query["dataset"].ToString());
    var database = new ProjectDatabase(ResolveProjectDbPath(contentRoot, selectedDataset.Id), selectedDataset);
    EnsureDatasetImported(repositoryRoot, database);

    if (!database.Exists)
    {
        return Results.Content(
            RenderShell("database", RenderMissingDatabase(database.DatabasePath), "Adatbázis böngésző"),
            "text/html; charset=utf-8");
    }

    var browser = database.LoadBrowser(request.Query);
    return Results.Content(RenderDatabasePage(browser, datasets.All), "text/html; charset=utf-8");
}

static void EnsureDatasetImported(string repositoryRoot, ProjectDatabase database)
{
    if (database.Exists)
    {
        return;
    }

    var result = ProjectImporter.Import(repositoryRoot, database.DatabasePath, database.Dataset);
    Console.WriteLine($"Dataset importálva kérés előtt: {database.Dataset.Id}");
    PrintImportResult(result, database.DatabasePath, database.Dataset);
}

static string ResolveRepositoryRoot(string contentRoot)
{
    var directory = new DirectoryInfo(contentRoot);
    while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
    {
        directory = directory.Parent;
    }

    return directory?.FullName ?? Path.GetFullPath(Path.Combine(contentRoot, "..", "..", ".."));
}

string RenderShell(string active, string body, string subtitle)
{
    return $$"""
    <!doctype html>
    <html lang="hu">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Premade Graph adatbázis felület</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #1d2433;
          --muted: #667085;
          --line: #d8dee8;
          --paper: #f7f3ec;
          --panel: #ffffff;
          --accent: #0f766e;
          --soft: #edf7f5;
          --danger: #a63d40;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          background: var(--paper);
          color: var(--ink);
        }
        header {
          border-bottom: 1px solid var(--line);
          background: #fffdf8;
          padding: 22px 32px 18px;
        }
        .topline {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 24px;
          max-width: 1180px;
          margin: 0 auto;
        }
        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 46px);
          line-height: 1;
          letter-spacing: 0;
        }
        .subtitle {
          margin: 8px 0 0;
          color: var(--muted);
          max-width: 760px;
          font-size: 16px;
        }
        nav {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        nav a {
          border: 1px solid var(--line);
          color: var(--ink);
          padding: 9px 12px;
          text-decoration: none;
          background: var(--panel);
          font-size: 14px;
        }
        nav a.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
        main {
          max-width: 1180px;
          margin: 0 auto;
          padding: 30px 32px 48px;
        }
        .panel, .query-card, .notice {
          background: var(--panel);
          border: 1px solid var(--line);
          box-shadow: 0 18px 42px rgba(29, 36, 51, 0.08);
        }
        .panel {
          padding: 0;
          overflow: visible;
        }
        .panel h2, .notice h2 {
          margin: 0;
          padding: 18px 20px;
          border-bottom: 1px solid var(--line);
          font-size: 22px;
        }
        .notice {
          padding-bottom: 20px;
        }
        .notice p {
          margin: 16px 20px;
          color: var(--muted);
        }
        .notice code {
          color: var(--danger);
          font-weight: 700;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 15px;
        }
        th, td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--line);
          text-align: left;
          vertical-align: top;
        }
        th {
          background: var(--soft);
          color: #12413d;
        }
        code, .score {
          font-variant-numeric: tabular-nums;
        }
        .score { font-weight: 700; }
        .query-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .browser-toolbar, .browser-tabs, .pager {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: end;
          padding: 16px 20px;
          border-bottom: 1px solid var(--line);
          background: #fffdf8;
        }
        .browser-tabs a, .pager a, .pager span {
          border: 1px solid var(--line);
          color: var(--ink);
          background: var(--panel);
          padding: 8px 10px;
          text-decoration: none;
          font-size: 14px;
        }
        .browser-tabs a.active, .pager a.primary {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
        .table-note {
          padding: 0 20px 16px;
          color: var(--muted);
          background: #fffdf8;
          border-bottom: 1px solid var(--line);
        }
        .browser-toolbar label, .filter-row label {
          display: grid;
          gap: 5px;
          color: var(--muted);
          font-size: 13px;
        }
        .browser-toolbar input, .browser-toolbar select, .filter-row input {
          border: 1px solid var(--line);
          background: white;
          color: var(--ink);
          padding: 9px 10px;
          min-height: 38px;
          font: inherit;
          font-size: 14px;
        }
        .browser-toolbar button, .browser-toolbar a.clear-link, .filter-row button {
          border: 1px solid var(--accent);
          background: var(--accent);
          color: white;
          padding: 9px 12px;
          min-height: 38px;
          text-decoration: none;
          font: inherit;
          font-size: 14px;
          cursor: pointer;
        }
        .browser-toolbar a.clear-link {
          background: white;
          color: var(--accent);
        }
        .filter-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--line);
        }
        .table-scroll {
          overflow-x: auto;
          overflow-y: visible;
        }
        th a {
          color: #12413d;
          text-decoration: none;
        }
        .cell-json, .cell-text {
          max-width: 360px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cell-json {
          position: relative;
          padding-left: 38px;
        }
        .expand-cell {
          position: absolute;
          left: 10px;
          bottom: 8px;
          width: 20px;
          height: 20px;
          border: 1px solid var(--accent);
          color: var(--accent);
          background: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-weight: 700;
          line-height: 1;
        }
        .info {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          margin-left: 6px;
          border: 1px solid #8aa4a0;
          color: #12413d;
          background: #f5fbfa;
          font-size: 12px;
          cursor: help;
          position: relative;
        }
        .info:hover::after, .info:focus::after {
          content: attr(data-info);
          position: absolute;
          right: 0;
          top: 24px;
          z-index: 5;
          width: min(320px, calc(100vw - 48px));
          padding: 10px 12px;
          border: 1px solid var(--line);
          background: #17202f;
          color: #f8fafc;
          box-shadow: 0 12px 26px rgba(29, 36, 51, 0.2);
          font-weight: 400;
          line-height: 1.35;
          white-space: normal;
        }
        th:first-child .info:hover::after, th:first-child .info:focus::after {
          left: 0;
          right: auto;
        }
        .full-value pre {
          white-space: pre-wrap;
          word-break: break-word;
          max-height: none;
        }
        .empty {
          padding: 24px 20px;
          color: var(--muted);
        }
        .query-card {
          padding: 18px;
          min-width: 0;
        }
        .query-card h2 {
          margin: 0 0 4px;
          font-size: 20px;
        }
        .query-card p {
          margin: 0 0 12px;
          color: var(--muted);
        }
        pre {
          margin: 0;
          overflow: auto;
          padding: 14px;
          background: #17202f;
          color: #e7edf7;
          font-size: 13px;
          line-height: 1.45;
        }
        @media (max-width: 860px) {
          .topline { align-items: start; flex-direction: column; }
          .query-grid { grid-template-columns: 1fr; }
          main, header { padding-left: 18px; padding-right: 18px; }
        }
      </style>
    </head>
    <body>
      <header>
        <div class="topline">
          <div>
            <h1>Premade Graph adatbázis</h1>
            <p class="subtitle">{{Html(subtitle)}}</p>
          </div>
          <nav>
            {{Nav(AppUrl("/"), "Adatbázis böngésző", active == "database")}}
          </nav>
        </div>
      </header>
      <main>
        {{body}}
      </main>
    </body>
    </html>
    """;
}

static string RenderMissingDatabase(string databasePath)
{
    return $$"""
    <section class="notice">
      <h2>Hiányzik a generált projektadatbázis</h2>
      <p>A felület használatához először generáld le a valós backend adatbázisokból épített SQLite adatbázist:</p>
      <p><code>dotnet run -- import</code></p>
      <p>Elvárt célfájl: <code>{{Html(databasePath)}}</code></p>
    </section>
    """;
}

string RenderDatabasePage(BrowserPage browser, IReadOnlyList<DatasetInfo> datasets)
{
    return RenderShell(
        "database",
        RenderDatabaseBrowser(browser, datasets),
        $"Kész projektfelület a(z) {browser.Dataset.Name} datasethez: keresés, oszloponkénti szűrés, rendezés és lapozott betöltés.");
}

string RenderDatabaseBrowser(BrowserPage browser, IReadOnlyList<DatasetInfo> datasets)
{
    var datasetOptions = string.Join("", datasets.Select(dataset =>
    {
        var selected = dataset.Id == browser.Dataset.Id ? " selected" : "";
        return $"<option value=\"{Html(dataset.Id)}\"{selected}>{Html(dataset.Name)} ({Html(dataset.Id)})</option>";
    }));

    var tabs = string.Join("", BrowserCatalog.Tables.Select(table =>
    {
        var css = table.Name == browser.Table.Name ? " class=\"active\"" : "";
        return $"<a href=\"{BuildBrowserUrl(browser.Dataset.Id, table.Name, 1, browser.PageSize, browser.Search, table.DefaultSortColumn, browser.SortDirection, EmptyFilters())}\"{css} title=\"{Html(table.Description)}\">{Html(table.DisplayName)}</a>";
    }));

    var sortOptions = string.Join("", browser.Table.Columns.Select(column =>
    {
        var selected = column.Name == browser.SortColumn ? " selected" : "";
        return $"<option value=\"{Html(column.Name)}\"{selected}>{Html(column.DisplayName)}</option>";
    }));

    var pageSizeOptions = string.Join("", BrowserCatalog.PageSizes.Select(size =>
    {
        var selected = size == browser.PageSize ? " selected" : "";
        return $"<option value=\"{size}\"{selected}>{size}</option>";
    }));

    var directionOptions = string.Join("", new[] { ("asc", "Növekvő"), ("desc", "Csökkenő") }.Select(option =>
    {
        var selected = option.Item1 == browser.SortDirection ? " selected" : "";
        return $"<option value=\"{option.Item1}\"{selected}>{option.Item2}</option>";
    }));

    var filters = string.Join("", browser.Table.Columns.Select(column =>
    {
        browser.Filters.TryGetValue(column.Name, out var value);
        return $"""
        <label>
          {Html(column.DisplayName)} {Info(column.Description)}
          <input name="f_{Html(column.Name)}" value="{Html(value ?? "")}" placeholder="Szűrés">
        </label>
        """;
    }));

    var headers = string.Join("", browser.Table.Columns.Select(column =>
    {
        var nextDirection = browser.SortColumn == column.Name && browser.SortDirection == "asc" ? "desc" : "asc";
        var marker = browser.SortColumn == column.Name ? (browser.SortDirection == "asc" ? " ▲" : " ▼") : "";
        return $"<th><a href=\"{BuildBrowserUrl(browser.Dataset.Id, browser.Table.Name, 1, browser.PageSize, browser.Search, column.Name, nextDirection, browser.Filters)}\">{Html(column.DisplayName)}{marker}</a>{Info(column.Description)}</th>";
    }));

    var rows = browser.Rows.Count == 0
        ? $"""<tr><td colspan="{browser.Table.Columns.Count}" class="empty">Nincs találat a megadott feltételekkel.</td></tr>"""
        : string.Join("", browser.Rows.Select(row =>
        {
            var cells = string.Join("", browser.Table.Columns.Select(column =>
            {
                row.TryGetValue(column.Name, out var value);
                var css = column.IsLongText ? "cell-json" : "cell-text";
                var fullLink = column.FullValueLink
                    ? BuildFullValueLink(browser.Dataset.Id, browser.Table, column, row)
                    : "";
                return $"<td class=\"{css}\">{fullLink}{Html(value ?? "")}</td>";
            }));
            return $"<tr>{cells}</tr>";
        }));

    var previous = browser.Page > 1
        ? $"<a href=\"{BuildBrowserUrl(browser.Dataset.Id, browser.Table.Name, browser.Page - 1, browser.PageSize, browser.Search, browser.SortColumn, browser.SortDirection, browser.Filters)}\">Előző</a>"
        : "<span>Előző</span>";
    var next = browser.Page < browser.TotalPages
        ? $"<a class=\"primary\" href=\"{BuildBrowserUrl(browser.Dataset.Id, browser.Table.Name, browser.Page + 1, browser.PageSize, browser.Search, browser.SortColumn, browser.SortDirection, browser.Filters)}\">Következő</a>"
        : "<span>Következő</span>";

    var rangeText = browser.TotalRows == 0
        ? "0 / 0"
        : $"{browser.FirstRow}-{browser.LastRow} / {browser.TotalRows}";

    return $$"""
    <section class="panel">
      <h2>Adatbázis böngésző</h2>
      <form class="browser-toolbar" method="get" action="{{AppUrl("/database")}}">
        <input type="hidden" name="table" value="{{Html(browser.Table.Name)}}">
        <label>
          Dataset
          <select name="dataset">{{datasetOptions}}</select>
        </label>
        <button type="submit">Dataset megnyitása</button>
        <div>{{Html(browser.Dataset.Description)}}</div>
      </form>
      <div class="browser-tabs">{{tabs}}</div>
      <div class="table-note">{{Html(browser.Table.Description)}}</div>
      <form class="browser-toolbar" method="get" action="{{AppUrl("/database")}}">
        <input type="hidden" name="dataset" value="{{Html(browser.Dataset.Id)}}">
        <input type="hidden" name="table" value="{{Html(browser.Table.Name)}}">
        <label>
          Keresés
          <input name="search" value="{{Html(browser.Search)}}" placeholder="Globális keresés">
        </label>
        <label>
          Sor / oldal
          <select name="pageSize">{{pageSizeOptions}}</select>
        </label>
        <label>
          Rendezés
          <select name="sort">{{sortOptions}}</select>
        </label>
        <label>
          Irány
          <select name="dir">{{directionOptions}}</select>
        </label>
        <input type="hidden" name="page" value="1">
        <button type="submit">Alkalmaz</button>
        <a class="clear-link" href="{{AppUrl("/database")}}?dataset={{Html(browser.Dataset.Id)}}&table={{Html(browser.Table.Name)}}">Törlés</a>
        <div>{{Html(rangeText)}} · {{browser.TotalPages}} oldal</div>
      </form>
      <form method="get" action="{{AppUrl("/database")}}">
        <input type="hidden" name="dataset" value="{{Html(browser.Dataset.Id)}}">
        <input type="hidden" name="table" value="{{Html(browser.Table.Name)}}">
        <input type="hidden" name="search" value="{{Html(browser.Search)}}">
        <input type="hidden" name="pageSize" value="{{browser.PageSize}}">
        <input type="hidden" name="sort" value="{{Html(browser.SortColumn)}}">
        <input type="hidden" name="dir" value="{{Html(browser.SortDirection)}}">
        <input type="hidden" name="page" value="1">
        <div class="filter-row">
          {{filters}}
          <label>
            &nbsp;
            <button type="submit">Oszlopszűrők alkalmazása</button>
          </label>
        </div>
      </form>
      <div class="table-scroll">
        <table>
          <thead><tr>{{headers}}</tr></thead>
          <tbody>{{rows}}</tbody>
        </table>
      </div>
      <div class="pager">
        {{previous}}
        <span>{{browser.Page}} / {{browser.TotalPages}}</span>
        {{next}}
      </div>
    </section>
    """;
}

string RenderFullValuePage(BrowserFullValue value, IReadOnlyList<DatasetInfo> datasets)
{
    var backUrl = BuildBrowserUrl(value.Dataset.Id, value.Table.Name, 1, BrowserCatalog.PageSizes[0], "", value.Table.DefaultSortColumn, "asc", EmptyFilters());
    return RenderShell(
        "database",
        $$"""
        <section class="panel full-value">
          <h2>{{Html(value.Table.DisplayName)}} / {{Html(value.Column.DisplayName)}}</h2>
          <div class="browser-toolbar">
            <a class="clear-link" href="{{backUrl}}">Vissza az adatbázis böngészőhöz</a>
            <div>Kulcs: <code>{{Html(value.KeyText)}}</code></div>
          </div>
          <pre><code>{{Html(value.Value)}}</code></pre>
        </section>
        """,
        "Teljes mezőérték külön betöltve, hogy a böngésző táblanézete gyors maradjon.");
}

static string Nav(string href, string label, bool active)
{
    var css = active ? " class=\"active\"" : "";
    return $"<a href=\"{href}\"{css}>{Html(label)}</a>";
}

static string Info(string description) =>
    $"<span class=\"info\" tabindex=\"0\" title=\"{Html(description)}\" data-info=\"{Html(description)}\">i</span>";

string BuildFullValueLink(string datasetId, BrowserTable table, BrowserColumn column, IReadOnlyDictionary<string, string> row)
{
    var parts = new List<string>
    {
        $"dataset={WebUtility.UrlEncode(datasetId)}",
        $"table={WebUtility.UrlEncode(table.Name)}",
        $"column={WebUtility.UrlEncode(column.Name)}"
    };

    foreach (var keyColumn in table.KeyColumns)
    {
        if (!row.TryGetValue(keyColumn, out var value) || string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        parts.Add($"key_{WebUtility.UrlEncode(keyColumn)}={WebUtility.UrlEncode(value)}");
    }

    return $"<a class=\"expand-cell\" href=\"{AppUrl("/database/value")}?{string.Join("&", parts)}\" title=\"Teljes mező megnyitása\">+</a>";
}

string BuildBrowserUrl(
    string dataset,
    string table,
    int page,
    int pageSize,
    string search,
    string sort,
    string direction,
    IReadOnlyDictionary<string, string> filters)
{
    var parts = new List<string>
    {
        $"dataset={WebUtility.UrlEncode(dataset)}",
        $"table={WebUtility.UrlEncode(table)}",
        $"page={page}",
        $"pageSize={pageSize}",
        $"sort={WebUtility.UrlEncode(sort)}",
        $"dir={WebUtility.UrlEncode(direction)}"
    };

    if (!string.IsNullOrWhiteSpace(search))
    {
        parts.Add($"search={WebUtility.UrlEncode(search)}");
    }

    foreach (var filter in filters.Where(item => !string.IsNullOrWhiteSpace(item.Value)).OrderBy(item => item.Key))
    {
        parts.Add($"f_{WebUtility.UrlEncode(filter.Key)}={WebUtility.UrlEncode(filter.Value)}");
    }

    return AppUrl("/database") + "?" + string.Join("&", parts);
}

static IReadOnlyDictionary<string, string> EmptyFilters() => new Dictionary<string, string>();

static string Html(string value) => WebUtility.HtmlEncode(value);

string AppUrl(string path)
{
    if (string.IsNullOrWhiteSpace(appBasePath))
    {
        return path;
    }

    return appBasePath + (path.StartsWith('/') ? path : "/" + path);
}

static string NormalizeBasePath(string? value)
{
    if (string.IsNullOrWhiteSpace(value) || value == "/")
    {
        return "";
    }

    var trimmed = value.Trim();
    if (!trimmed.StartsWith('/'))
    {
        trimmed = "/" + trimmed;
    }

    return trimmed.TrimEnd('/');
}

sealed class ProjectDatabase(string databasePath, DatasetInfo dataset)
{
    public string DatabasePath => databasePath;
    public DatasetInfo Dataset => dataset;
    public bool Exists => File.Exists(databasePath);

    public BrowserPage LoadBrowser(IQueryCollection query)
    {
        var table = BrowserCatalog.ResolveTable(query["table"].ToString());
        var pageSize = BrowserCatalog.ResolvePageSize(query["pageSize"].ToString());
        var page = Math.Max(1, ParseInt(query["page"].ToString(), 1));
        var search = query["search"].ToString().Trim();
        var sortColumn = table.ResolveColumn(query["sort"].ToString())?.Name ?? table.DefaultSortColumn;
        var sortDirection = string.Equals(query["dir"].ToString(), "desc", StringComparison.OrdinalIgnoreCase) ? "desc" : "asc";
        var filters = table.Columns
            .Select(column => new KeyValuePair<string, string>(column.Name, query[$"f_{column.Name}"].ToString().Trim()))
            .Where(item => !string.IsNullOrWhiteSpace(item.Value))
            .ToDictionary(item => item.Key, item => item.Value, StringComparer.OrdinalIgnoreCase);

        if (!File.Exists(databasePath))
        {
            return BrowserPage.Empty(dataset, table, page, pageSize, search, sortColumn, sortDirection, filters);
        }

        using var connection = new SqliteConnection($"Data Source={databasePath};Mode=ReadOnly");
        connection.Open();

        var whereParts = new List<string>();
        var parameterValues = new Dictionary<string, string>();

        if (!string.IsNullOrWhiteSpace(search) && table.SearchableColumns.Count > 0)
        {
            var searchClauses = table.SearchableColumns
                .Select(column => $"CAST({column} AS TEXT) LIKE $search")
                .ToArray();
            whereParts.Add("(" + string.Join(" OR ", searchClauses) + ")");
            parameterValues["$search"] = $"%{search}%";
        }

        var filterIndex = 0;
        foreach (var filter in filters)
        {
            var column = table.ResolveColumn(filter.Key);
            if (column is null)
            {
                continue;
            }

            var parameterName = $"$filter{filterIndex++}";
            whereParts.Add($"CAST({column.Name} AS TEXT) LIKE {parameterName}");
            parameterValues[parameterName] = $"%{filter.Value}%";
        }

        var whereSql = whereParts.Count == 0 ? "" : " WHERE " + string.Join(" AND ", whereParts);
        var totalRows = CountFiltered(connection, table, whereSql, parameterValues);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalRows / (double)pageSize));
        page = Math.Min(page, totalPages);
        var offset = (page - 1) * pageSize;

        var rows = LoadBrowserRows(connection, table, whereSql, parameterValues, sortColumn, sortDirection, pageSize, offset);
        return new BrowserPage(dataset, table, page, pageSize, search, sortColumn, sortDirection, filters, totalRows, rows);
    }

    public BrowserFullValue LoadFullValue(IQueryCollection query)
    {
        var table = BrowserCatalog.ResolveTable(query["table"].ToString());
        var column = table.ResolveColumn(query["column"].ToString());
        if (!File.Exists(databasePath))
        {
            return BrowserFullValue.NotReady(databasePath, dataset, table, column ?? table.Columns[0], "");
        }

        if (column is null || !column.FullValueLink)
        {
            return BrowserFullValue.Ready(dataset, table, table.Columns[0], "", "Ismeretlen vagy nem megnyitható mező.");
        }

        var keyValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var keyColumn in table.KeyColumns)
        {
            var value = query[$"key_{keyColumn}"].ToString();
            if (string.IsNullOrWhiteSpace(value))
            {
                return BrowserFullValue.Ready(dataset, table, column, "", "Hiányzó kulcsérték.");
            }

            keyValues[keyColumn] = value;
        }

        using var connection = new SqliteConnection($"Data Source={databasePath};Mode=ReadOnly");
        connection.Open();

        var whereSql = string.Join(" AND ", table.KeyColumns.Select(key => $"{key} = ${key}"));
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT {column.Name} FROM {table.Name} WHERE {whereSql} LIMIT 1";
        foreach (var key in keyValues)
        {
            command.Parameters.AddWithValue($"${key.Key}", key.Value);
        }

        var result = command.ExecuteScalar();
        var keyText = string.Join(", ", keyValues.Select(item => $"{item.Key}={item.Value}"));
        return BrowserFullValue.Ready(dataset, table, column, keyText, result is null or DBNull ? "" : Convert.ToString(result) ?? "");
    }

    private static int Count(SqliteConnection connection, string table)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT COUNT(*) FROM {table}";
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private static int CountFiltered(
        SqliteConnection connection,
        BrowserTable table,
        string whereSql,
        IReadOnlyDictionary<string, string> parameterValues)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT COUNT(*) FROM {table.Name}{whereSql}";
        AddParameters(command, parameterValues);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    private static IReadOnlyList<Dictionary<string, string>> LoadBrowserRows(
        SqliteConnection connection,
        BrowserTable table,
        string whereSql,
        IReadOnlyDictionary<string, string> parameterValues,
        string sortColumn,
        string sortDirection,
        int pageSize,
        int offset)
    {
        using var command = connection.CreateCommand();
        var columns = string.Join(", ", table.Columns.Select(column => column.SelectExpression));
        command.CommandText = $"""
        SELECT {columns}
        FROM {table.Name}
        {whereSql}
        ORDER BY {sortColumn} {sortDirection.ToUpperInvariant()}
        LIMIT $limit OFFSET $offset
        """;
        AddParameters(command, parameterValues);
        command.Parameters.AddWithValue("$limit", pageSize);
        command.Parameters.AddWithValue("$offset", offset);

        using var reader = command.ExecuteReader();
        var rows = new List<Dictionary<string, string>>();
        while (reader.Read())
        {
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var index = 0; index < table.Columns.Count; index++)
            {
                row[table.Columns[index].Name] = reader.IsDBNull(index) ? "" : Convert.ToString(reader.GetValue(index)) ?? "";
            }

            rows.Add(row);
        }

        return rows;
    }

    private static void AddParameters(SqliteCommand command, IReadOnlyDictionary<string, string> parameterValues)
    {
        foreach (var parameter in parameterValues)
        {
            command.Parameters.AddWithValue(parameter.Key, parameter.Value);
        }
    }

    private static int ParseInt(string value, int fallback) =>
        int.TryParse(value, out var parsed) ? parsed : fallback;

}

sealed class DatasetCatalog(IReadOnlyList<DatasetInfo> all, DatasetInfo current)
{
    public IReadOnlyList<DatasetInfo> All { get; } = all;
    public DatasetInfo Current { get; } = current;

    public DatasetInfo Resolve(string requested)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            var match = All.FirstOrDefault(dataset => string.Equals(dataset.Id, requested, StringComparison.OrdinalIgnoreCase));
            if (match is not null)
            {
                return match;
            }
        }

        return Current;
    }

    public static DatasetCatalog Load(string repositoryRoot)
    {
        var registryPath = Path.Combine(repositoryRoot, "backend", "data", "datasets.json");
        if (!File.Exists(registryPath))
        {
            var fallback = new DatasetInfo(
                "legacy",
                "Legacy adatbázis",
                "Régi, dataset-regiszter nélküli adatforrás.",
                Path.Combine(repositoryRoot, "backend", "players.db"),
                Path.Combine(repositoryRoot, "playersrefined.db"));
            return new DatasetCatalog([fallback], fallback);
        }

        using var document = JsonDocument.Parse(File.ReadAllText(registryPath));
        var root = document.RootElement;
        var currentDatasetId = root.TryGetProperty("currentDatasetId", out var currentElement)
            ? currentElement.GetString() ?? ""
            : "";

        var datasets = new List<DatasetInfo>();
        foreach (var datasetElement in root.GetProperty("datasets").EnumerateArray())
        {
            var id = datasetElement.GetProperty("id").GetString() ?? "default";
            var name = datasetElement.TryGetProperty("name", out var nameElement) ? nameElement.GetString() ?? id : id;
            var description = datasetElement.TryGetProperty("description", out var descriptionElement) ? descriptionElement.GetString() ?? "" : "";
            var rawDbPath = datasetElement.TryGetProperty("rawDbPath", out var rawElement) ? rawElement.GetString() ?? "" : "";
            var refinedDbPath = datasetElement.TryGetProperty("refinedDbPath", out var refinedElement) ? refinedElement.GetString() ?? "" : "";

            datasets.Add(new DatasetInfo(
                id,
                name,
                description,
                ResolveRegistryPath(repositoryRoot, rawDbPath),
                ResolveRegistryPath(repositoryRoot, refinedDbPath)));
        }

        if (datasets.Count == 0)
        {
            throw new InvalidOperationException("A dataset-regiszter nem tartalmaz datasetet.");
        }

        var current = datasets.FirstOrDefault(dataset => dataset.Id == currentDatasetId) ?? datasets[0];
        return new DatasetCatalog(datasets, current);
    }

    private static string ResolveRegistryPath(string repositoryRoot, string registryPath)
    {
        if (Path.IsPathRooted(registryPath))
        {
            return registryPath;
        }

        return Path.GetFullPath(Path.Combine(repositoryRoot, "backend", registryPath.Replace('/', Path.DirectorySeparatorChar)));
    }
}

record DatasetInfo(string Id, string Name, string Description, string PlayersDbPath, string RefinedDbPath);

static class ProjectImporter
{
    public static ImportResult Import(string repositoryRoot, string targetDbPath, DatasetInfo dataset)
    {
        var sourcePlayersDb = dataset.PlayersDbPath;
        var sourceClustersDb = dataset.RefinedDbPath;
        var replayDb = Path.Combine(repositoryRoot, "backend", "pathfinder_replays.db");
        var sourceReplaysDb = File.Exists(replayDb) ? replayDb : sourcePlayersDb;

        RequireFile(sourcePlayersDb);
        RequireFile(sourceReplaysDb);

        Directory.CreateDirectory(Path.GetDirectoryName(targetDbPath)!);
        if (File.Exists(targetDbPath))
        {
            File.Delete(targetDbPath);
        }

        using var target = new SqliteConnection($"Data Source={targetDbPath}");
        target.Open();
        CreateProjectSchema(target);

        using var players = new SqliteConnection($"Data Source={sourcePlayersDb};Mode=ReadOnly");
        using var replays = new SqliteConnection($"Data Source={sourceReplaysDb};Mode=ReadOnly");
        players.Open();
        replays.Open();

        var playerCount = CopyPlayers(players, target);
        var clusterCount = 0;
        var clusterMemberCount = 0;
        if (File.Exists(sourceClustersDb))
        {
            using var clusters = new SqliteConnection($"Data Source={sourceClustersDb};Mode=ReadOnly");
            clusters.Open();
            if (HasTable(clusters, "clusters"))
            {
                clusterCount = CopyClusters(clusters, target);
            }

            if (HasTable(clusters, "cluster_members"))
            {
                clusterMemberCount = CopyClusterMembers(clusters, target);
            }
        }

        var replayCount = CopyReplays(replays, target, dataset);
        var replayRunCount = CopyReplayRuns(replays, target, dataset);

        return new ImportResult(playerCount, clusterCount, clusterMemberCount, replayCount, replayRunCount);
    }

    private static void RequireFile(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Forrás adatbázis nem található: {path}", path);
        }
    }

    private static void CreateProjectSchema(SqliteConnection connection)
    {
        ExecuteNonQuery(connection, """
        PRAGMA foreign_keys = ON;

        CREATE TABLE players (
            puuid TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            detected_role TEXT NOT NULL DEFAULT 'UNKNOWN',
            match_count INTEGER NOT NULL DEFAULT 0,
            opscore REAL NOT NULL DEFAULT 0,
            feedscore REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE clusters (
            cluster_id TEXT PRIMARY KEY,
            cluster_type TEXT NOT NULL,
            algorithm TEXT,
            size INTEGER NOT NULL,
            best_op TEXT,
            worst_feed TEXT,
            summary_json TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE cluster_members (
            cluster_id TEXT NOT NULL,
            puuid TEXT NOT NULL,
            is_bridge INTEGER NOT NULL DEFAULT 0,
            is_star INTEGER NOT NULL DEFAULT 0,
            is_best_op INTEGER NOT NULL DEFAULT 0,
            is_worst_feed INTEGER NOT NULL DEFAULT 0,
            role_json TEXT,
            PRIMARY KEY (cluster_id, puuid),
            FOREIGN KEY (cluster_id) REFERENCES clusters(cluster_id) ON DELETE CASCADE
        );

        CREATE TABLE pathfinder_replays (
            id INTEGER PRIMARY KEY,
            cache_key TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            execution_mode TEXT NOT NULL,
            source_player_id TEXT NOT NULL,
            target_player_id TEXT NOT NULL,
            source_label TEXT NOT NULL,
            target_label TEXT NOT NULL,
            dataset_player_count INTEGER NOT NULL,
            path_mode TEXT NOT NULL,
            weighted_mode INTEGER NOT NULL,
            selected_algorithm TEXT NOT NULL,
            comparison_rows_json TEXT NOT NULL,
            dataset_id TEXT,
            dataset_name TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE pathfinder_replay_runs (
            id INTEGER PRIMARY KEY,
            replay_id INTEGER NOT NULL,
            algorithm TEXT NOT NULL,
            runtime_ms REAL NOT NULL,
            nodes_visited INTEGER NOT NULL,
            path_length INTEGER NOT NULL,
            run_json TEXT NOT NULL,
            FOREIGN KEY (replay_id) REFERENCES pathfinder_replays(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_players_score ON players(opscore DESC, match_count DESC);
        CREATE INDEX idx_cluster_members_cluster ON cluster_members(cluster_id);
        CREATE INDEX idx_replay_runs_replay ON pathfinder_replay_runs(replay_id);
        """);
    }

    private static int CopyPlayers(SqliteConnection source, SqliteConnection target)
    {
        using var select = source.CreateCommand();
        select.CommandText = """
        SELECT
            COALESCE(NULLIF(puuid, ''), 'name:' || lower(hex(names))) AS import_id,
            COALESCE(NULLIF(names, ''), COALESCE(NULLIF(puuid, ''), 'Ismeretlen játékos')) AS display_name,
            CAST(COALESCE(match_count, 0) AS INTEGER) AS match_count,
            CAST(COALESCE(opscore, 0) AS REAL) AS opscore,
            CAST(COALESCE(feedscore, 0) AS REAL) AS feedscore
        FROM players
        WHERE names IS NOT NULL AND names <> ''
        ORDER BY opscore DESC, match_count DESC, display_name ASC
        """;

        using var transaction = target.BeginTransaction();
        using var insert = target.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = """
        INSERT OR IGNORE INTO players (puuid, display_name, detected_role, match_count, opscore, feedscore)
        VALUES ($puuid, $display_name, 'UNKNOWN', $match_count, $opscore, $feedscore)
        """;
        var puuid = insert.Parameters.Add("$puuid", SqliteType.Text);
        var displayName = insert.Parameters.Add("$display_name", SqliteType.Text);
        var matchCount = insert.Parameters.Add("$match_count", SqliteType.Integer);
        var opscore = insert.Parameters.Add("$opscore", SqliteType.Real);
        var feedscore = insert.Parameters.Add("$feedscore", SqliteType.Real);

        var count = 0;
        using var reader = select.ExecuteReader();
        while (reader.Read())
        {
            puuid.Value = reader.GetString(0);
            displayName.Value = reader.GetString(1);
            matchCount.Value = reader.GetInt32(2);
            opscore.Value = reader.GetDouble(3);
            feedscore.Value = reader.GetDouble(4);
            count += insert.ExecuteNonQuery();
        }

        transaction.Commit();
        return count;
    }

    private static int CopyClusters(SqliteConnection source, SqliteConnection target)
    {
        using var select = source.CreateCommand();
        select.CommandText = """
        SELECT cluster_id, cluster_type, algorithm, size, best_op, worst_feed, summary_json, updated_at
        FROM clusters
        ORDER BY cluster_type, size DESC, cluster_id
        """;

        using var transaction = target.BeginTransaction();
        using var insert = target.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = """
        INSERT INTO clusters (cluster_id, cluster_type, algorithm, size, best_op, worst_feed, summary_json, updated_at)
        VALUES ($cluster_id, $cluster_type, $algorithm, $size, $best_op, $worst_feed, $summary_json, $updated_at)
        """;
        var clusterId = insert.Parameters.Add("$cluster_id", SqliteType.Text);
        var clusterType = insert.Parameters.Add("$cluster_type", SqliteType.Text);
        var algorithm = insert.Parameters.Add("$algorithm", SqliteType.Text);
        var size = insert.Parameters.Add("$size", SqliteType.Integer);
        var bestOp = insert.Parameters.Add("$best_op", SqliteType.Text);
        var worstFeed = insert.Parameters.Add("$worst_feed", SqliteType.Text);
        var summaryJson = insert.Parameters.Add("$summary_json", SqliteType.Text);
        var updatedAt = insert.Parameters.Add("$updated_at", SqliteType.Text);

        var count = 0;
        using var reader = select.ExecuteReader();
        while (reader.Read())
        {
            clusterId.Value = reader.GetString(0);
            clusterType.Value = reader.GetString(1);
            algorithm.Value = ReadNullableString(reader, 2);
            size.Value = reader.GetInt32(3);
            bestOp.Value = ReadNullableString(reader, 4);
            worstFeed.Value = ReadNullableString(reader, 5);
            summaryJson.Value = ReadNullableString(reader, 6);
            updatedAt.Value = reader.GetString(7);
            count += insert.ExecuteNonQuery();
        }

        transaction.Commit();
        return count;
    }

    private static int CopyClusterMembers(SqliteConnection source, SqliteConnection target)
    {
        using var select = source.CreateCommand();
        select.CommandText = """
        SELECT cluster_id, puuid, is_bridge, is_star, is_best_op, is_worst_feed, role_json
        FROM cluster_members
        ORDER BY cluster_id, puuid
        """;

        using var transaction = target.BeginTransaction();
        using var insert = target.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = """
        INSERT OR IGNORE INTO cluster_members (
            cluster_id, puuid, is_bridge, is_star, is_best_op, is_worst_feed, role_json
        )
        VALUES ($cluster_id, $puuid, $is_bridge, $is_star, $is_best_op, $is_worst_feed, $role_json)
        """;
        var clusterId = insert.Parameters.Add("$cluster_id", SqliteType.Text);
        var puuid = insert.Parameters.Add("$puuid", SqliteType.Text);
        var isBridge = insert.Parameters.Add("$is_bridge", SqliteType.Integer);
        var isStar = insert.Parameters.Add("$is_star", SqliteType.Integer);
        var isBestOp = insert.Parameters.Add("$is_best_op", SqliteType.Integer);
        var isWorstFeed = insert.Parameters.Add("$is_worst_feed", SqliteType.Integer);
        var roleJson = insert.Parameters.Add("$role_json", SqliteType.Text);

        var count = 0;
        using var reader = select.ExecuteReader();
        while (reader.Read())
        {
            clusterId.Value = reader.GetString(0);
            puuid.Value = reader.GetString(1);
            isBridge.Value = reader.GetInt32(2);
            isStar.Value = reader.GetInt32(3);
            isBestOp.Value = reader.GetInt32(4);
            isWorstFeed.Value = reader.GetInt32(5);
            roleJson.Value = ReadNullableString(reader, 6);
            count += insert.ExecuteNonQuery();
        }

        transaction.Commit();
        return count;
    }

    private static int CopyReplays(SqliteConnection source, SqliteConnection target, DatasetInfo dataset)
    {
        var hasDatasetId = HasColumn(source, "pathfinder_replays", "dataset_id");
        var hasDatasetName = HasColumn(source, "pathfinder_replays", "dataset_name");
        using var select = source.CreateCommand();
        select.CommandText = $"""
        SELECT id, cache_key, title, execution_mode, source_player_id, target_player_id,
               source_label, target_label, dataset_player_count, path_mode, weighted_mode,
               selected_algorithm, comparison_rows_json,
               {(hasDatasetId ? "dataset_id" : "'default'")},
               {(hasDatasetName ? "dataset_name" : "NULL")},
               created_at
        FROM pathfinder_replays
        {(hasDatasetId ? "WHERE dataset_id = $dataset_id" : "")}
        ORDER BY created_at DESC, id DESC
        """;
        if (hasDatasetId)
        {
            select.Parameters.AddWithValue("$dataset_id", dataset.Id);
        }

        using var transaction = target.BeginTransaction();
        using var insert = target.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = """
        INSERT INTO pathfinder_replays (
            id, cache_key, title, execution_mode, source_player_id, target_player_id,
            source_label, target_label, dataset_player_count, path_mode, weighted_mode,
            selected_algorithm, comparison_rows_json, dataset_id, dataset_name, created_at
        )
        VALUES (
            $id, $cache_key, $title, $execution_mode, $source_player_id, $target_player_id,
            $source_label, $target_label, $dataset_player_count, $path_mode, $weighted_mode,
            $selected_algorithm, $comparison_rows_json, $dataset_id, $dataset_name, $created_at
        )
        """;

        var id = insert.Parameters.Add("$id", SqliteType.Integer);
        var cacheKey = insert.Parameters.Add("$cache_key", SqliteType.Text);
        var title = insert.Parameters.Add("$title", SqliteType.Text);
        var executionMode = insert.Parameters.Add("$execution_mode", SqliteType.Text);
        var sourcePlayer = insert.Parameters.Add("$source_player_id", SqliteType.Text);
        var targetPlayer = insert.Parameters.Add("$target_player_id", SqliteType.Text);
        var sourceLabel = insert.Parameters.Add("$source_label", SqliteType.Text);
        var targetLabel = insert.Parameters.Add("$target_label", SqliteType.Text);
        var datasetPlayerCount = insert.Parameters.Add("$dataset_player_count", SqliteType.Integer);
        var pathMode = insert.Parameters.Add("$path_mode", SqliteType.Text);
        var weightedMode = insert.Parameters.Add("$weighted_mode", SqliteType.Integer);
        var selectedAlgorithm = insert.Parameters.Add("$selected_algorithm", SqliteType.Text);
        var comparisonRows = insert.Parameters.Add("$comparison_rows_json", SqliteType.Text);
        var datasetId = insert.Parameters.Add("$dataset_id", SqliteType.Text);
        var datasetName = insert.Parameters.Add("$dataset_name", SqliteType.Text);
        var createdAt = insert.Parameters.Add("$created_at", SqliteType.Text);

        var count = 0;
        using var reader = select.ExecuteReader();
        while (reader.Read())
        {
            id.Value = reader.GetInt32(0);
            cacheKey.Value = reader.GetString(1);
            title.Value = reader.GetString(2);
            executionMode.Value = reader.GetString(3);
            sourcePlayer.Value = reader.GetString(4);
            targetPlayer.Value = reader.GetString(5);
            sourceLabel.Value = reader.GetString(6);
            targetLabel.Value = reader.GetString(7);
            datasetPlayerCount.Value = reader.GetInt32(8);
            pathMode.Value = reader.GetString(9);
            weightedMode.Value = reader.GetInt32(10);
            selectedAlgorithm.Value = reader.GetString(11);
            comparisonRows.Value = reader.GetString(12);
            datasetId.Value = string.IsNullOrWhiteSpace(ReadNullableString(reader, 13)) ? dataset.Id : ReadNullableString(reader, 13);
            datasetName.Value = string.IsNullOrWhiteSpace(ReadNullableString(reader, 14)) ? dataset.Name : ReadNullableString(reader, 14);
            createdAt.Value = reader.GetString(15);
            count += insert.ExecuteNonQuery();
        }

        transaction.Commit();
        return count;
    }

    private static int CopyReplayRuns(SqliteConnection source, SqliteConnection target, DatasetInfo dataset)
    {
        var hasDatasetId = HasColumn(source, "pathfinder_replays", "dataset_id");
        using var select = source.CreateCommand();
        select.CommandText = $"""
        SELECT rr.id, rr.replay_id, rr.algorithm, rr.runtime_ms, rr.nodes_visited, rr.path_length, rr.run_json
        FROM pathfinder_replay_runs rr
        JOIN pathfinder_replays r ON r.id = rr.replay_id
        {(hasDatasetId ? "WHERE r.dataset_id = $dataset_id" : "")}
        ORDER BY rr.replay_id, rr.runtime_ms ASC
        """;
        if (hasDatasetId)
        {
            select.Parameters.AddWithValue("$dataset_id", dataset.Id);
        }

        using var transaction = target.BeginTransaction();
        using var insert = target.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = """
        INSERT INTO pathfinder_replay_runs (
            id, replay_id, algorithm, runtime_ms, nodes_visited, path_length, run_json
        )
        VALUES ($id, $replay_id, $algorithm, $runtime_ms, $nodes_visited, $path_length, $run_json)
        """;
        var id = insert.Parameters.Add("$id", SqliteType.Integer);
        var replayId = insert.Parameters.Add("$replay_id", SqliteType.Integer);
        var algorithm = insert.Parameters.Add("$algorithm", SqliteType.Text);
        var runtimeMs = insert.Parameters.Add("$runtime_ms", SqliteType.Real);
        var nodesVisited = insert.Parameters.Add("$nodes_visited", SqliteType.Integer);
        var pathLength = insert.Parameters.Add("$path_length", SqliteType.Integer);
        var runJson = insert.Parameters.Add("$run_json", SqliteType.Text);

        var count = 0;
        using var reader = select.ExecuteReader();
        while (reader.Read())
        {
            id.Value = reader.GetInt32(0);
            replayId.Value = reader.GetInt32(1);
            algorithm.Value = reader.GetString(2);
            runtimeMs.Value = reader.GetDouble(3);
            nodesVisited.Value = reader.GetInt32(4);
            pathLength.Value = reader.GetInt32(5);
            runJson.Value = reader.GetString(6);
            count += insert.ExecuteNonQuery();
        }

        transaction.Commit();
        return count;
    }

    private static bool HasColumn(SqliteConnection connection, string table, string column)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({table})";
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static bool HasTable(SqliteConnection connection, string table)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $table";
        command.Parameters.AddWithValue("$table", table);
        return Convert.ToInt32(command.ExecuteScalar()) > 0;
    }

    private static void ExecuteNonQuery(SqliteConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    private static string ReadNullableString(IDataRecord reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? "" : reader.GetString(ordinal);
}

static class BrowserCatalog
{
    public static readonly int[] PageSizes = [25, 50, 100];
    private const string JsonPreview = "CASE WHEN length({0}) > 240 THEN substr({0}, 1, 240) || ' ...' ELSE {0} END";
    private const string RunJsonPreview = """
        CASE
            WHEN json_valid(run_json) AND json_array_length(run_json, '$.path.nodes') IS NOT NULL
            THEN 'path.nodes: ' ||
                 COALESCE((SELECT group_concat(substr(value, 1, 12) || '...', ' -> ')
                           FROM (SELECT value FROM json_each(run_json, '$.path.nodes') LIMIT 4)), '') ||
                 CASE WHEN json_array_length(run_json, '$.path.nodes') > 4 THEN ' -> (...)' ELSE '' END
            WHEN length(run_json) > 240 THEN substr(run_json, 1, 240) || ' ...'
            ELSE run_json
        END
        """;

    public static readonly IReadOnlyList<BrowserTable> Tables =
    [
        new(
            "players",
            "Játékosok",
            "A backend players.db adatbázisából átvett játékostörzs. Teljesítmény- és szerepmezői a többi tábla értelmezéséhez adnak kontextust.",
            [
                new("puuid", "PUUID", "A játékos stabil azonosítója. Logikai kapcsolatként megjelenik a klasztertagságokban és az útkeresési mentésekben.", true),
                new("display_name", "Játékos", "A felületen olvasható játékosnév."),
                new("detected_role", "Szerep", "A backend által becsült fő játékszerep."),
                new("match_count", "Meccsek", "A játékoshoz összegyűjtött meccsek száma."),
                new("opscore", "opscore", "Teljesítményjellegű pontszám, magasabb érték jobb mért teljesítményt jelez."),
                new("feedscore", "feedscore", "Kockázatosabb vagy gyengébb teljesítménymintát jelző pontszám.")
            ],
            ["puuid", "display_name", "detected_role"],
            "display_name",
            ["puuid"]),
        new(
            "clusters",
            "Klaszterek",
            "A playersrefined.db-ből átvett közösségek. A cluster_members táblával együtt írja le, mely játékosok tartoznak egy klaszterbe.",
            [
                new("cluster_id", "Klaszter", "A klaszter egyedi azonosítója. Erre hivatkozik a cluster_members.cluster_id.", true),
                new("cluster_type", "Típus", "A klaszter eredete vagy családja, például populációs vagy útkeresési klaszter."),
                new("algorithm", "Algoritmus", "A klasztert létrehozó elemzési módszer neve."),
                new("size", "Méret", "A klaszter számított mérete."),
                new("best_op", "Legjobb opscore", "A klaszter legerősebb opscore értékű tagjának azonosítója vagy neve."),
                new("worst_feed", "Legrosszabb feedscore", "A klaszter legrosszabb feedscore értékű tagjának azonosítója vagy neve."),
                new("summary_json", "Összegzés JSON", "Tömörített klaszter-összefoglaló backendből átvett JSON formában.", true, true, string.Format(JsonPreview, "summary_json")),
                new("updated_at", "Frissítve", "A klaszteradat utolsó frissítési ideje.")
            ],
            ["cluster_id", "cluster_type", "algorithm", "best_op", "worst_feed", "summary_json"],
            "size",
            ["cluster_id"]),
        new(
            "cluster_members",
            "Klasztertagságok",
            "Kapcsolótábla a klaszterek és a játékosok között. A cluster_id tényleges SQLite idegen kulcs, a puuid logikai játékoshivatkozás.",
            [
                new("cluster_id", "Klaszter", "Annak a klaszternek az azonosítója, amelyhez a tagság tartozik.", true),
                new("puuid", "PUUID", "A tag játékos logikai azonosítója, a players.puuid mezőhöz kapcsolódik.", true),
                new("is_bridge", "Híd", "1, ha a játékos a klaszterek vagy közösségek között híd szerepet tölt be."),
                new("is_star", "Kiemelt", "1, ha a játékos a klaszteren belül kiemelt szerepű."),
                new("is_best_op", "Legjobb op", "1, ha a játékos a klaszter legjobb opscore értékű tagja."),
                new("is_worst_feed", "Legrosszabb feed", "1, ha a játékos a klaszter legrosszabb feedscore értékű tagja."),
                new("role_json", "Szerep JSON", "A klaszteren belüli szerepleírás JSON formában.", true, true, string.Format(JsonPreview, "role_json"))
            ],
            ["cluster_id", "puuid", "role_json"],
            "cluster_id",
            ["cluster_id", "puuid"]),
        new(
            "pathfinder_replays",
            "Útkeresési mentések",
            "Egy útkeresési kérés és összehasonlítás mentett fejléce. A pathfinder_replay_runs tábla tárolja hozzá a konkrét algoritmusfutásokat.",
            [
                new("id", "ID", "A mentett útkeresési replay elsődleges kulcsa."),
                new("cache_key", "Cache kulcs", "A backend cache azonosítója, amely ugyanazt a kéréskonfigurációt azonosítja.", true),
                new("title", "Cím", "A mentés megjelenített címe."),
                new("execution_mode", "Futtatási mód", "A pathfinder végrehajtási módja."),
                new("source_player_id", "Forrás ID", "A keresés kezdő játékosának logikai azonosítója."),
                new("target_player_id", "Cél ID", "A keresés cél játékosának logikai azonosítója."),
                new("source_label", "Forrás", "A kezdő játékos olvasható címkéje."),
                new("target_label", "Cél", "A cél játékos olvasható címkéje."),
                new("dataset_player_count", "Játékosszám", "Az útkereséshez használt adathalmaz játékosszáma."),
                new("path_mode", "Út mód", "Az útkeresés gráfmódja."),
                new("weighted_mode", "Súlyozott", "1, ha az útkeresés súlyozott élekkel futott."),
                new("selected_algorithm", "Algoritmus", "A felhasználó vagy backend által kiválasztott algoritmus."),
                new("comparison_rows_json", "Összehasonlítás JSON", "Az algoritmus-összehasonlítás rövidített JSON eredménye.", true, true, string.Format(JsonPreview, "comparison_rows_json")),
                new("dataset_id", "Dataset ID", "A mentéshez kapcsolódó adathalmaz technikai azonosítója."),
                new("dataset_name", "Dataset név", "A mentéshez kapcsolódó adathalmaz neve."),
                new("created_at", "Létrehozva", "A replay mentés létrehozási ideje.")
            ],
            ["cache_key", "title", "execution_mode", "source_player_id", "target_player_id", "source_label", "target_label", "path_mode", "selected_algorithm", "comparison_rows_json", "dataset_id", "dataset_name"],
            "created_at",
            ["id"]),
        new(
            "pathfinder_replay_runs",
            "Útkeresési futások",
            "Egy mentett útkeresés konkrét algoritmusfutásai. A run_json nagyon nagy lehet, ezért a táblanézet csak az út első néhány csúcsát mutatja, a teljes JSON külön nyílik meg.",
            [
                new("id", "ID", "Az algoritmusfutás elsődleges kulcsa."),
                new("replay_id", "Mentés ID", "A pathfinder_replays.id mezőre hivatkozó idegen kulcs."),
                new("algorithm", "Algoritmus", "A konkrét futás algoritmusa."),
                new("runtime_ms", "Futásidő ms", "A futás mért ideje milliszekundumban."),
                new("nodes_visited", "Bejárt csúcsok", "Az algoritmus által bejárt csúcsok száma."),
                new("path_length", "Úthossz", "A megtalált út hossza csúcsok/élek alapján."),
                new("run_json", "Futás JSON", "A teljes pathfinder futás JSON lenyomata. A táblában csak az első néhány path node látszik; a + gomb külön oldalon tölti be a teljes mezőt.", true, true, RunJsonPreview)
            ],
            ["algorithm", "run_json"],
            "replay_id",
            ["id"])
    ];

    public static BrowserTable ResolveTable(string requested) =>
        Tables.FirstOrDefault(table => string.Equals(table.Name, requested, StringComparison.OrdinalIgnoreCase))
        ?? Tables[0];

    public static int ResolvePageSize(string requested)
    {
        if (int.TryParse(requested, out var parsed) && PageSizes.Contains(parsed))
        {
            return parsed;
        }

        return PageSizes[0];
    }
}

record ImportResult(int PlayerCount, int ClusterCount, int ClusterMemberCount, int ReplayCount, int ReplayRunCount);
record BrowserColumn(
    string Name,
    string DisplayName,
    string Description,
    bool IsLongText = false,
    bool FullValueLink = false,
    string? PreviewExpression = null)
{
    public string SelectExpression => PreviewExpression is null ? Name : $"{PreviewExpression} AS {Name}";
}

record BrowserTable(
    string Name,
    string DisplayName,
    string Description,
    IReadOnlyList<BrowserColumn> Columns,
    IReadOnlyList<string> SearchableColumns,
    string DefaultSortColumn,
    IReadOnlyList<string> KeyColumns)
{
    public BrowserColumn? ResolveColumn(string name) =>
        Columns.FirstOrDefault(column => string.Equals(column.Name, name, StringComparison.OrdinalIgnoreCase));
}

record BrowserPage(
    DatasetInfo Dataset,
    BrowserTable Table,
    int Page,
    int PageSize,
    string Search,
    string SortColumn,
    string SortDirection,
    IReadOnlyDictionary<string, string> Filters,
    int TotalRows,
    IReadOnlyList<Dictionary<string, string>> Rows)
{
    public int TotalPages => Math.Max(1, (int)Math.Ceiling(TotalRows / (double)PageSize));
    public int FirstRow => TotalRows == 0 ? 0 : ((Page - 1) * PageSize) + 1;
    public int LastRow => Math.Min(Page * PageSize, TotalRows);

    public static BrowserPage Empty(
        DatasetInfo dataset,
        BrowserTable table,
        int page,
        int pageSize,
        string search,
        string sortColumn,
        string sortDirection,
        IReadOnlyDictionary<string, string> filters) =>
        new(dataset, table, page, pageSize, search, sortColumn, sortDirection, filters, 0, []);
}

record BrowserFullValue(
    bool IsReady,
    string DatabasePath,
    DatasetInfo Dataset,
    BrowserTable Table,
    BrowserColumn Column,
    string KeyText,
    string Value)
{
    public static BrowserFullValue NotReady(string path, DatasetInfo dataset, BrowserTable table, BrowserColumn column, string keyText) =>
        new(false, path, dataset, table, column, keyText, "");

    public static BrowserFullValue Ready(DatasetInfo dataset, BrowserTable table, BrowserColumn column, string keyText, string value) =>
        new(true, "", dataset, table, column, keyText, value);
}
